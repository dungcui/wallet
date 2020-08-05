
const Promise = require('bluebird');
const _ = require('lodash');
const Decimal = require('decimal.js');
// const debug = require('debug')('wallet:btc_service');
const { Address, HDPublicKey, Networks } = require('bitcore-lib');
const utils = require('../../utils');
const constants = require('./qtum_constants');
const Service = require('../service');


Networks.add(constants.QTUM_MAINNET);


class QtumService extends Service {
  constructor({
    db,
    block,
    token,
    wallet,
    address,
    funding,
    withdrawal,
    qtumRpc: api,
    qtumInterpreter: interpreter,
    qtumMaximumInput,
    qtumMaximumFee,
    qtumMaximumFeePerByte,
    qtumAverageFeeBlocks,
  }) {
    const error = {
      INVALID_XPUBS: 'Missing xpubs or there are more than 1 xpubs',
    };
    super({
      db,
      api,
      block,
      token,
      wallet,
      address,
      funding,
      withdrawal,
      name: constants.NAME,
      error,
      baseFee: constants.BASE_FEE,
      currency: constants.CURRENCY,
      feeCurrency: constants.FEE_CURRENCY,
      interpreter,
    });
    this.maximumInput = Number(qtumMaximumInput);
    this.maximumFee = Number(qtumMaximumFee);
    this.maximumFeePerByte = parseInt(qtumMaximumFeePerByte, 10);
    this.averageFeeBlocks = parseInt(qtumAverageFeeBlocks, 10);

    // this.debug("ssss ",constants.QTUM_MAINNET);
  }

  async validateWallet(req) {
    const { xpubs } = req;

    if (!xpubs.length && xpubs.length > 1) throw Error(this.error.INVALID_XPUBS);
    const wallet = await this.wallets.findByXpubs(this.name, xpubs[0]);

    if (wallet) throw Error(this.error.ALREADY_HAS_WALLET);
  }

  async ping() {
    const time = String(new Date().getTime());
    return { time };
  }

  /* eslint-disable class-methods-use-this */
  async getBalance() {
    throw Error('Not implement');
  }

  async computeTotalBalances(wallet) {
    const balances = {};
    const { currency } = this;
    const amount = await this.fundings
      .sumUnspentAmountByWalletIdAndCurrency(wallet.id, currency);
      balances[currency] = { amount };
    return balances;
  }

  capTransaction(availableBalances, transactions) {
    const balances = { ...availableBalances };
    const maximumAmount = new Decimal(balances[this.currency].amount)
      .mul(constants.BTC_TO_SATOSHI)
      .sub(this.maximumFee)
      .round();
    let txs = transactions.map(tx => ({
      ...tx,
      amount: new Decimal(tx.amount), // satoshis ...
    }));

    let total = new Decimal(0);
    txs = txs.filter((t) => {
      total = total.add(t.amount);
      return total.lte(maximumAmount);
    });
    return txs;
  }

  async getMeta(wallet, transactions ,isColdWallet = false) {
    if (transactions.length === 0) {
      throw Error('Insufficient fund');
    }
    // transactions: capTransactions ...
    let unspentTxOuts = await this.fundings.findTopUnspentByWalletIdAndCurrencyWithTypeWallets(
      wallet.id,
      this.currency,
      this.maximumInput,
      isColdWallet
    );
    unspentTxOuts = unspentTxOuts.map(tx => ({
      ...tx,
      amount: new Decimal(tx.amount), // by satoshis ...
    }));
    // calculate maximumAmount by satoshis ...
    // const maximumAmount = unspentTxOuts.reduce(
    //   (acc, txOut) => acc.add(txOut.amount),
    //   new Decimal(0),
    // );

    // recalculate unspentTxOuts ...
    const total = transactions
      .reduce((acc, t) => acc.add(t.amount), new Decimal(0))
      .add(this.maximumFee);

    // if (maximumAmount.lt(total)) {
    //   throw Error('Insufficient fund');
    // }
    let sum = new Decimal(0);
    unspentTxOuts = unspentTxOuts.filter((t) => {
      if (sum.lte(total)) {
        sum = sum.add(t.amount);
        return true;
      }
      return false;
    });

    if (sum.lte(total)) {
      throw Error('Insufficient fund');
    }
    const inputs = await Promise.map(unspentTxOuts, async (t) => {
      const address = await this.addresses.find(t.addressId);
      return {
        script: t.script,
        transactionHash: t.transactionHash,
        outputIndex: t.outputIndex,
        amount: new Decimal((new Decimal(t.amount)*new Decimal(constants.BTC_TO_SATOSHI))).round().toFixed(),
        hdPath: address.path,
      };
    });

    const outputs = transactions.map((t) => {
      t.amount = new Decimal(new Decimal(t.amount)*new Decimal(constants.BTC_TO_SATOSHI)).round().toFixed();
      return t;
    });
    const result = {
      successTransactions: transactions.map(t => t.id),
      inputs,
      outputs,
    };
    return result;
  }

  async computeAvailableWithdrawals(wallet,isColdWallet = true) {
    const balances = {};
    const { currency } = this;
    let utxos = await this.fundings.findTopUnspentByWalletIdAndCurrencyWithTypeWallets(
      wallet.id,
      currency,
      this.maximumInput,
      isColdWallet,
    );
    utxos = utxos.map(tx => ({
      ...tx,
      amount: new Decimal(tx.amount),
    }));
    const amount = utxos
      .reduce((acc, t) => acc.add(t.amount), new Decimal(0))
      .toFixed();
    balances[currency] = { amount };
    return balances;
  }

  async validateAddress(req) {
    const { hash } = req;
    try {
      const address = Address.fromString(hash, Networks.QTUM_MAINNET);
      if (address.toString() !== hash) {
        throw Error('Address not match');
      }
      return { valid: true };
    } catch (err) {
      return { valid: false };
    }
  }

  async decodeRawTransaction(req) {
    const { raw } = req;
    try {
      const txDecoded = await this.api.decodeRawTransaction(raw);
      return { transaction_hash: txDecoded.txid };
    } catch (err) {
      return { transaction_hash: null };
    }
  }


 async computeTotalBalances(wallet, isColdWallet) {
    const balances = {};
    const { currency } = this;
    const amount = await this.fundings
    .sumUnspentAmountByWalletIdAndCurrencyWithTypeWallet(wallet.id, currency, isColdWallet)
    balances[currency] = { amount };
    return balances;
  }
  async getTotalBalance (currency , walletId , isColdWallet = true)
  { 
    let totalBalance = "";
    isColdWallet = (isColdWallet==='true');
    try {
      console.log('QTUM_Service.getTotalBalance')
      const wallet = await this.wallets.find(walletId);
      const balance = await this.computeTotalBalances(wallet , isColdWallet);
      console.log('balance:',balance);
      totalBalance = balance.QTUM.amount;
    }
    catch (err){
      console.log('QTUM.getTotalBalance.err:',err);
      totalBalance = "0";
    }
    console.log('QTUM.totalBalance:',totalBalance);
    return {currency, totalBalance }
  }
}

module.exports = QtumService;

