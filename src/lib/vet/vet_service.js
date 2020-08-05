const Decimal = require('./vet_utils').decimal();
const debug = require('debug')('wallet:vet_service');
const Promise = require('bluebird');
const snakeCaseKeys = require('snakecase-keys');
const hdkey = require('ethereumjs-wallet/hdkey');
const utils = require('./vet_utils');
const web3 = require('web3');

class VetService {
  constructor({
    vetApi, vetWallet, vetAddress, db, vetBlock, vetTransaction,
  }) {
    this.api = vetApi;
    this.wallets = vetWallet;
    this.addresses = vetAddress;
    this.db = db;
    this.transactions = vetTransaction;
    this.blocks = vetBlock;
    this.currencies = ['VET', 'VTHO'];

    this.errorMessage = this.constructor.errorMessage;
    this.CHAIN_TAG = '0x4a';
    this.GAS_LIMIT = 21000;

    this.ERROR_MSG = this.constructor.ERROR_MSG;
    this.web3Utils = web3.utils;
  }


  // setter for ERROR_MSG
  static get ERROR_MSG() { return utils.getCommonErrors(); }


  async getAddress(req) {
    debug(`Request getAddress: ${JSON.stringify(req)}`);

    const { path, walletId } = req;
    if (!path) throw Error(this.ERROR_MSG.MISSING_PATH);

    const wallet = await this.wallets.find(walletId);
    if (!wallet) throw Error(this.ERROR_MSG.WALLET_NOT_FOUND);
    console.log("wallet",wallet);
    const found = await this.addresses.findByPath({ walletId, path });
    if (found) return { hash: found.hash };
    
    const address = hdkey
      .fromExtendedKey(wallet.xpub)
      .derivePath(`m/${path}`)
      .getWallet()
      .getAddressString();

    await this.addresses.add({
      hash: address,
      path,
      type: this.addresses.TYPE.USER,
      walletId: wallet.id,
    });

    return { hash: address };
  }


  async addWallet(req) {
    const { xpubs , xpubsColdWallets , minimum } = req;

    if (!xpubs || !xpubs.length || !xpubsColdWallets || !xpubsColdWallets.length ) throw Error(this.ERROR_MSG.MISSING_XPUB);

    const found = await this.wallets.findByXPub(xpubs[0]);
    if (found) throw Error(this.ERROR_MSG.WALLET_EXISTED);

    const walletId = await this.wallets.add({ xpubs, xpubsColdWallets , minimum });
    const address = hdkey
      .fromExtendedKey(xpubs[0])
      .derivePath(`m/${this.addresses.SETTLEMENT_PATH}`)
      .getWallet()
      .getAddressString();

    const coldAddress = hdkey
      .fromExtendedKey(xpubsColdWallets[0])
      .derivePath(`m/${this.addresses.COLDWALLET}`)
      .getWallet()
      .getAddressString();  

    await this.addresses.add({
      path: this.addresses.SETTLEMENT_PATH,
      hash: address,
      walletId,
      type: this.addresses.TYPE.SETTLEMENT,
    });

    await this.addresses.add({
      path: this.addresses.COLDWALLET,
      hash: coldAddress,
      walletId,
      type: this.addresses.TYPE.COLDWALLET,
    });

    return {
      id: walletId,
      changeAddress: address,
      feeAddress: '',
    };
  }


  async validateAddress({ hash }) {
    // The VechainThor address structure is same as ETH, so we can use web3
    const { isAddress, isHexStrict } = this.web3Utils;

    // isHexStrict ensure hash must start with 0x
    if (isHexStrict(hash) && isAddress(hash)) return { valid: true };
    return { valid: false };
  }


  async bundleMoveFund({ walletId, currency , isColdWallet = true}) {
    if (!walletId) throw Error(this.ERROR_MSG.MISSING_WALLET_ID);
    if (!currency) throw Error(this.ERROR_MSG.MISSING_CURRENCY);

    const moveFundNeededTxs = await this.transactions.findMoveFundNeeded({ walletId, currency ,isColdWallet});

    const bundledTxs = moveFundNeededTxs.map(tx => ({
      id: tx.id,
      fromPath: tx.toPath,
      toPath: this.addresses.SETTLEMENT_PATH,
      grossAmount: new Decimal(tx.grossAmount).div(this.api.WEI_TO_VET).toFixed(),
    }));

    return { bundledTxs, estimatedGas: bundledTxs.length ? this.GAS_LIMIT : 0 };
  }


  async bundleWithdrawal({ walletId, transactions , isColdWallet = true}) {
    if (!walletId) throw Error(this.ERROR_MSG.MISSING_WALLET_ID);
    if (!transactions) throw Error(this.ERROR_MSG.MISSING_TRANSACTIONS);

    const settlement = await this.addresses.findSettlement(walletId);
    if (!settlement) throw Error(this.ERROR_MSG.SETTLEMENT_NOT_FOUND);

    const wei = await this.api.getEnergy(settlement.hash);
    if (!wei) throw Error(this.ERROR_MSG.SETTLEMENT_INSUFFICIENT_GAS);

    const gas = new Decimal(wei).div(this.api.WEI_TO_GAS);
    const maxTx = Math.floor((gas - this.api.txGas) / this.api.clauseGas);

    if (maxTx === 0) throw Error(this.ERROR_MSG.SETTLEMENT_INSUFFICIENT_GAS);

    let estGas = this.api.clauseGas * Math.min(transactions.length, maxTx);
    estGas += this.api.txGas;

    const bundledTxs = transactions.slice(0, maxTx).map(tx => ({
      id: tx.id,
      toAddress: tx.toAddress,
      grossAmount: tx.grossAmount,
      fromPath: settlement.path,
    }));

    return { bundledTxs, estimatedGas: estGas };
  }


  async bundleTransactions(req) {
    debug(`Request bundleTransactions: ${JSON.stringify(req)}`);
    const { type, walletId, transactions, currency } = req;
    let result = {};

    if (!walletId) throw Error(this.ERROR_MSG.MISSING_WALLET_ID);

    // const latestBlock = await this.blocks.getLatest();
    // console.log("latestBlock" ,latestBlock);
    // if (!latestBlock) throw Error(this.ERROR_MSG.BLOCK_NOT_FOUND);
    const latestHash = await this.api.getLatestBlockHash();

    // const decoded = await this.api.decodeRawTransaction("f8714a8733b6266ee0b89764d8d79492e7709d42d1eb73201064ba52f125c8d1ca939a648081808252088083bc614ec0b8417d413ddb4a64b8274346e6aaaf177852a20ef9dfdbb77a2b6c43f24125d5ce5c75d450ef92fefeb4eb7050357764a8b7db9d9eb245d033c15ac5f016461d3b5f00");

    // console.log("decoded",decoded);
    // blockref is the first 8 bytes of block hash
    const blockRef = `0x${latestHash.substr(2, 16)}`;

    if (type === this.transactions.TYPE.MOVE_FUND) {
      result = await this.bundleMoveFund({ walletId, currency }, isColdWallet = true);
    } else if (type === this.transactions.TYPE.WITHDRAWAL) {
      result = await this.bundleWithdrawal({ walletId, transactions }, isColdWallet = true);
    }

    const payload = {
      transactions: result.bundledTxs || [],
      meta: {
        gasPrice: result.estimatedGas,
        blockRef,
        chainTag: this.CHAIN_TAG,
        type,
        walletId,
      },
    };

    return { payload: JSON.stringify(snakeCaseKeys(payload, { deep: true })) };
  }


  async broadcast(req) {
    const { payload, currency } = req;
    debug(`Request broadcast: `,payload);

    if (!payload) throw Error(this.ERROR_MSG.MISSING_PAYLOAD);

    const { walletId: walletId, type, transactionsHash: txHash } = JSON.parse(payload);
    console.log("type",type);
    if (!type || !txHash) throw Error(this.ERROR_MSG.INVALID_PAYLOAD);

    if (type === this.transactions.TYPE.MOVE_FUND) {
      return this.broadcastMoveFund({ currency, walletId, txHash });
    }

    return this.broadcastWithdrawal({ currency, walletId, txHash });
  }


  async broadcastMoveFund({ currency, walletId, txHash }) {
    const broadcastedTxsHash = {};

    return this.db.transaction(async (trx) => {
      try {
        await Promise.each(Object.entries(txHash), async ([id, tx]) => {
          // With this set before hand, when `sendSignedTransaction` throw exception
          // it still has the tx id to insert to db later.
          console.log("hash",tx.hash);
          broadcastedTxsHash[id] = '';

          const txId = await this.api.sendSignedTransaction('0x'+tx.hash) || '';
          if (!txId) debug(`Broadcast failed for txId ${id} - txRaw ${tx.hash}`);

          broadcastedTxsHash[id] = txId;
        });
      } catch (err) {
        throw err;
      } finally {
        // Ensure whether sendSignedTransaction success or not
        // it will always insert "broadcasted" txs to database.
        const txData = { broadcastedTxsHash, txHash, walletId, currency };
        await this.transactions.addPendingMoveFund(txData, trx);
      }

      return { payload: JSON.stringify({}) };
    });
  }


  async broadcastWithdrawal({ currency, walletId, txHash }) {
    const broadcastedTxsHash = {};
    const successTxsHash = {};
    let hash = '';

    return this.db.transaction(async (trx) => {
      // Accept only one signed hash in the payload because when sign,
      // sign-tool merge all transactions into one.
      const signedHashes = Object.values(txHash).filter(hex => hex !== null);
      if (signedHashes.length > 1) throw Error(this.ERROR_MSG.INVALID_WITHDRAWAL_BUNDLE);

      const [id, signedHash] = Object.entries(txHash).filter(([, hex]) => hex !== null)[0];

      try {
        hash = await this.api.sendSignedTransaction(signedHash) || '';
        if (!hash) debug(`Broadcast failed for txId ${id} - txRaw ${signedHash}`);
      } catch (err) {
        throw err;
      } finally {
        // Ensure whether sendSignedTransaction success or not
        // it will always insert "broadcasted" txs to database.
        broadcastedTxsHash[id] = hash;
        const txData = { broadcastedTxsHash, txHash, walletId, currency };
        await this.transactions.addPendingWithdrawal(txData, trx);
      }

      if (hash) {
        Object.keys(txHash).forEach((key) => { successTxsHash[key] = hash; });
      }

      return { payload: JSON.stringify(successTxsHash) };
    });
  }


  async getStatus(req) {
    const { currency, walletId } = req;

    if (!currency) throw Error(this.ERROR_MSG.MISSING_CURRENCY);
    if (!walletId) throw Error(this.ERROR_MSG.MISSING_WALLET_ID);

    const settlement = await this.addresses.findSettlement(walletId);

    if (!settlement) throw Error(this.ERROR_MSG.SETTLEMENT_NOT_FOUND);

    const availableWithdrawal = await this.api.getBalance(settlement.hash);
    const totalMoveFundNeeded = await this.transactions.getTotalMoveFundNeeded({
      walletId, currency,
    });

    const totalMoveFundPending = await this.transactions.getTotalMoveFundPending({
      walletId, currency,
    });

    const availableBalance = new Decimal(totalMoveFundNeeded)
      .add(availableWithdrawal)
      .toFixed();

    const totalBalance = new Decimal(availableBalance)
      .add(totalMoveFundPending)
      .toFixed();

    return {
      availableWithdrawal: new Decimal(availableWithdrawal).div(this.api.WEI_TO_VET).toFixed(),
      availableBalance: new Decimal(availableBalance).div(this.api.WEI_TO_VET).toFixed(),
      totalBalance: new Decimal(totalBalance).div(this.api.WEI_TO_VET).toFixed(),
    };
  }

  // Get balance of settlement address (admin wallet)
  async getTotalBalance (currency , walletId , isColdWallet = true )
  {
    let totalBalance = "";
    isColdWallet = (isColdWallet==='true');
    let address = '';
    try {
      const wallet = await this.wallets.find(walletId);
      if(!isColdWallet)
      {
        address = wallet.settlementAddress;
      } else
      {
        address = wallet.coldSettlementAddress;
      }
      const balance = await this.api.getBalance(address);
      console.log('balance:',balance);
      totalBalance = this.web3Utils.fromWei(balance, "ether");
    }
    catch (err) {
      console.log('VET.getTotalBalance.err:',err);
      totalBalance = "0";
    }
    console.log('VET.totalBalance:',totalBalance);
    return {currency, totalBalance}
  }

  async getLastestBlock(currency) {
    const block = await this.api.getLatestBlockHeight();
    return { currency, height : block };
  }

}

module.exports = VetService;
