const DbTable = require("../../model/db_table");
const Promise = require('bluebird');
const { Transaction: ThorTransaction } = require('thor-devkit');
const Decimal = require('./vet_utils').decimal();

class VetTransaction extends DbTable {
  constructor({ db, vetAddress }) {
    super(db, 'vet_transactions');

    this.addresses = vetAddress;

    this.TYPE = {
      WITHDRAWAL: 'withdrawal',
      MOVE_FUND: 'move_fund',
      FUNDING: 'funding',
      FUNDING_SETTLEMENT: 'funding_settlement',
    };

    this.STATE = {
      FAILED: 'failed',
      PENDING: 'pending',
      CONFIRMED: 'confirmed',
    };

    this.checkTransferType = this.constructor.checkTransferType;
    this.VTHO_CONTRACT_ADDRESS = '0x0000000000000000000000000000456e65726779';
  }


  static checkTransferType(clause) {
    if (!clause || !clause.data) return {};

    if (clause.data === '0x') {
      return {
        currency: 'VET',
        grossAmount: new Decimal(clause.value).toFixed(),
      };
    }

    // Match if transaction data start with "0xa9059cbb" which is the signature
    // for `transfer(address,uint256)`. The method is used to transfer VTHO
    const isVTHOContract = clause.to === this.VTHO_CONTRACT_ADDRESS;
    const isVTHOTransfer = /^(0x)?a9059cbb[0-9a-zA-Z]{128}$/i.test(clause.data);
    if (isVTHOTransfer && isVTHOContract) {
      return {
        currency: 'VTHO',
        grossAmount: new Decimal(`0x${clause.data.slice(-64)}`).toFixed(),
      };
    }

    return {};
  }


  async findMoveFundNeeded({ walletId, currency , isColdWallet}, trx) {
    if(!isColdWallet)
    {  
      return this.createQuery(trx)
        .select(`${this.tableName}.*`)
        .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
        .where(`${this.tableName}.currency`, currency)
        .where(`${this.tableName}.walletId`, walletId)
        .where(`${this.tableName}.type`, this.TYPE.FUNDING)
        .whereNot(`${this.addresses.tableName}.type`, 'cold')
        .whereNull(`${this.tableName}.moveFundAtTxHash`);
    } else {
      return this.createQuery(trx)
        .select(`${this.tableName}.*`)
        .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
        .where(`${this.tableName}.walletId`, walletId)
        .where(`${this.tableName}.type`, this.TYPE.FUNDING)
        .where(`${this.tableName}.currency`, currency)
        .where(`${this.addresses.tableName}.type`, 'cold')
        .whereNull(`${this.tableName}.moveFundAtTxHash`);
    } 
  }


  async addMany(transactions, trx) {
    const txs = transactions.map((el) => {
      const copy = Object.assign({}, el);

      Object.keys(copy).forEach((key) => {
        if (['hash', 'toAddress', 'fromAddress'].indexOf(key) !== -1) {
          copy[key] = copy[key].toLowerCase();
        }
      });

      return copy;
    });

    return this.createQuery(trx).insert(txs);
  }


  async addSettlementFunding(transactions, confirmedTxsHash = [], trx) {
    const fundingSettlements = [];
    const txsMap = confirmedTxsHash.reduce((acc, hash) => ({ ...acc, [hash]: 1 }), {});

    transactions.forEach((tx) => {
      if (txsMap[tx.id.toLowerCase()]) return;

      tx.clauses.forEach((clause, clauseIndex) => {
        if (clause.address && clause.address.type === this.addresses.TYPE.SETTLEMENT) {
          const { currency, grossAmount } = this.checkTransferType(clause);

          fundingSettlements.push({
            hash: tx.id.toLowerCase(),
            clauseIndex,
            toAddress: clause.to.toLowerCase(),
            toPath: clause.address.path,
            toAddressId: clause.address.id,
            fromAddress: tx.origin.toLowerCase(),
            state: this.STATE.CONFIRMED,
            type: this.TYPE.FUNDING_SETTLEMENT,
            walletId: clause.address.walletId,
            blockHeight: tx.meta.blockNumber,
            grossAmount,
            currency,
          });
        }
      });
    });

    await this.createQuery(trx).insert(fundingSettlements);
  }


  async confirmTxs(transactions = [], trx) {
    const confirmedTxs = [];

    await Promise.each(transactions, async (tx) => {
      const { address } = tx.clauses[0];
      if (address && address.type === this.addresses.TYPE.USER) return;

      const txs = await this
        .createQuery(trx)
        .returning(['hash', 'type'])
        .where({ hash: tx.id.toLowerCase(), state: this.STATE.PENDING })
        .update({
          state: this.STATE.CONFIRMED,
          blockHeight: tx.meta.blockNumber,
          fromAddress: tx.origin.toLowerCase(),
        });

      if (txs.length) {
        // Only get the first one because one tx hash might has multiple rows
        confirmedTxs.push(txs[0]);
      }
    });

    const confirmedTxsHash = confirmedTxs.map(tx => tx.hash);
    await this.addSettlementFunding(transactions, confirmedTxsHash, trx);

    return confirmedTxs
      .filter(tx => tx.type === this.TYPE.WITHDRAWAL)
      .map(tx => tx.hash);
  }


  async addFundingTxs(transactions = [], trx) {
    const newTxs = [];

    transactions.forEach((tx) => {
      tx.clauses.forEach((clause, clauseIndex) => {
        if (!clause.address || clause.address.type !== this.addresses.TYPE.USER) {
          return;
        }

        const { currency, grossAmount } = this.checkTransferType(clause);

        newTxs.push({
          hash: tx.id,
          clauseIndex,
          fromAddress: tx.origin,
          toAddressId: clause.address.id,
          toAddress: clause.address.hash,
          toPath: clause.address.path,
          walletId: clause.address.walletId,
          type: this.TYPE.FUNDING,
          state: this.STATE.CONFIRMED,
          grossAmount,
          currency,
          blockHeight: tx.meta.blockNumber,
        });
      });
    });

    if (!newTxs.length) return;

    await this.addMany(newTxs, trx);
  }


  async getTotalMoveFundNeeded({ walletId, currency }, trx) {
    if (!walletId || !currency) {
      throw Error('Missing `walletId` or `currency`');
    }

    const { total } = await this
      .createQuery(trx)
      .sum({ total: 'grossAmount' })
      .where({
        moveFundAtTxHash: null,
        walletId,
        currency,
        type: this.TYPE.FUNDING,
      })
      .first();

    return total || 0;
  }


  async getTotalMoveFundPending({ walletId, currency }, trx) {
    if (!walletId || !currency) {
      throw Error('Missing `walletId` or `currency`');
    }

    const { total } = await this
      .createQuery(trx)
      .sum('grossAmount as total')
      .where({
        walletId,
        currency,
        state: this.STATE.PENDING,
        type: this.TYPE.MOVE_FUND,
      })
      .first();

    return total || 0;
  }


  async addPendingMoveFund({ broadcastedTxsHash, currency, txHash, walletId }, trx) {
    if (!currency) throw Error('Missing `currency`');
    if (!walletId) throw Error('Missing `walletId`');

    const pendingMoveFundTxs = [];
    const settlement = await this.addresses.findSettlement(walletId, trx);

    await Promise.each(Object.entries(broadcastedTxsHash), async ([id, hash]) => {
      // Match move-fund tx with funding tx
      await this.createQuery(trx).where({ id }).update({
        moveFundAtTxHash: hash.toLowerCase(),
      });

      const { body: tx } = ThorTransaction.decode(txHash[id]);

      tx.clauses.forEach((clause, clauseIndex) => {
        pendingMoveFundTxs.push({
          type: this.TYPE.MOVE_FUND,
          state: this.STATE.PENDING,
          walletId,
          clauseIndex,
          hash: hash.toLowerCase(),
          toAddress: clause.to.toLowerCase(),
          toAddressId: settlement.id,
          toPath: settlement.path,
          grossAmount: new Decimal(clause.value).toFixed(),
          currency,
        });
      });
    });

    await this.createQuery(trx).insert(pendingMoveFundTxs);
  }


  async addPendingWithdrawal({ broadcastedTxsHash, currency, txHash, walletId }, trx) {
    if (!currency) throw Error('Missing `currency`');
    if (!walletId) throw Error('Missing `walletId`');

    const pendingWithdrawalTxs = [];
    const settlement = await this.addresses.findSettlement(walletId, trx);

    Object.entries(broadcastedTxsHash).forEach(([id, hash]) => {
      const { body: tx } = ThorTransaction.decode(txHash[id]);

      tx.clauses.forEach((clause, clauseIndex) => {
        pendingWithdrawalTxs.push({
          type: this.TYPE.WITHDRAWAL,
          state: this.STATE.PENDING,
          walletId,
          clauseIndex,
          hash: hash.toLowerCase(),
          toAddress: clause.to.toLowerCase(),
          fromAddress: settlement.hash,
          fromAddressId: settlement.id,
          fromPath: settlement.path,
          grossAmount: new Decimal(clause.value).toFixed(),
          currency,
        });
      });
    });

    await this.createQuery(trx).insert(pendingWithdrawalTxs);
  }
}

module.exports = VetTransaction;
