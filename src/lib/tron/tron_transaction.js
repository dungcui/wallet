const Promise = require('bluebird');

const DbTable = require("../../model/db_table");

class TronTransaction extends DbTable {
  constructor({ db, tronAddress }) {
    super(db, 'tron_transactions');
    this.addresses = tronAddress;
    this.type = { FUNDING: 'funding', MOVE_FUND: 'move_fund', WITHDRAWAL: 'withdrawal' };
    this.state = { IGNORED: 'ignored', FAILED: 'failed', PENDING: 'pending', CONFIRMED: 'confirmed' };
  }

  async add(transaction, trx) {
    return this.createQuery(trx).insert(transaction);
  }

  async loadTotalMoveFundPending(walletId, trx) {
    const { total } = await this.createQuery(trx)
      .sum('tron_transactions.grossAmount as total')
      .innerJoin('tron_transactions as t', 'tron_transactions.moveFundAtTransactionHash', 't.hash')
      .where('tron_transactions.walletId', walletId)
      .andWhere('t.state', this.state.PENDING)
      .first();
    return total || 0;
  }

  async loadTotalMoveFundNeeded(walletId, trx) {
    const { total } = await this.createQuery(trx)
      .sum('grossAmount as total')
      .where({
        type: this.type.FUNDING,
        walletId,
        moveFundAtTransactionHash: null,
      })
      .first();
    return total || 0;
  }

  async loadAllMoveFundNeeded(walletId,isColdWallet, trx) {
    if(!isColdWallet)
    {  
      return this.createQuery(trx)
        .select(`${this.tableName}.*`)
        .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
        .where(`${this.tableName}.walletId`, walletId)
        .where(`${this.tableName}.type`, this.TYPE.FUNDING)
        .whereNot(`${this.addresses.tableName}.type`, 'cold')
        .whereNull(`${this.tableName}.moveFundAtTransactionHash`);
    } else {
      return this.createQuery(trx)
        .select(`${this.tableName}.*`)
        .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
        .where(`${this.tableName}.walletId`, walletId)
        .where(`${this.tableName}.type`, this.TYPE.FUNDING)
        .where(`${this.addresses.tableName}.type`, 'cold')
        .whereNull(`${this.tableName}.moveFundAtTransactionHash`);
    } 
  }

  async confirm(transactions, trx) {
    await this.createQuery(trx)
      .whereIn('hash', transactions.map(tx => tx.hash))
      .where({ state: this.state.PENDING })
      .update({ state: this.state.CONFIRMED });

    return this.createQuery(trx).whereIn('hash', transactions.map(tx => tx.hash));
  }

  async addPendingWithdrawal(txsHash, walletId, trx) {
    const txEntries = Object.entries(txsHash);
    return Promise.each(txEntries, async ([bundleId, hash]) => {
      const type = this.type.WITHDRAWAL;
      const state = this.state.PENDING;
      await this.createQuery(trx).insert({ walletId, hash, type, state, bundleId });
    });
  }

  async addPendingMoveFund(txsHash, trx) {
    const txEntries = Object.entries(txsHash);
    console.log('addPendingMoveFund.txEntries:',txEntries);
    return Promise.each(txEntries, async ([index, tx]) => {
      const id  = tx.externalId;
      const hash = tx.transactionHash;
      const type = this.type.MOVE_FUND;
      const state = this.state.PENDING;
      await this.createQuery(trx).returning('walletId').where({ id }).update({ moveFundAtTransactionHash: hash , type , state });
      // const { walletId } = await this.createQuery(trx).select('walletId').where({ id }).first();
      // const type = this.type.MOVE_FUND;
      // const state = this.state.PENDING;
      // await this.createQuery(trx).insert({ walletId, hash, state, type });
    });
  }
}

module.exports = TronTransaction;
