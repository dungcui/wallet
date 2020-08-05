const Promise = require('bluebird');
const Decimal = require('decimal.js');
const utils = require('../../utils');
const constants = require('./bnb_constants');
const debug = require('debug')('wallet:worker');
const SPACE = ' ';
const bnbUtils = require('@binance-chain/javascript-sdk/lib/utils/index');

class BnbInterpreter {
  constructor({ db, address, bnbRpc }) {
    this.db = db;
    this.api = bnbRpc;
    this.addresses = address;
  }



  increaseExpiration(expiration, durationInMs) {
    const newExpiration = new Date(new Date(expiration).getTime() + durationInMs).toISOString();
    return newExpiration.slice(0, newExpiration.length - 1);
  }

  async getMeta(wallet, transactions,isColdWallet = true) {
    console.log('*---- BNB_interpreter.GETMETA ----*')
    let metas = []
    await Promise.each(transactions, async (transaction,index) => {
      const info = await this.api.getInfo();
      const chain_id = info.node_info.network;
      var settlementAddress = "";
      if (isColdWallet) {
        settlementAddress = wallet.coldSettlementAddress;
      } else {
        settlementAddress = wallet.settlementAddress;
      }
      const accountInfo = await this.api.getAccountInfo(settlementAddress);
      const addressAndMemo = utils.splitAddressAndMemo(transaction.address);
      const to = addressAndMemo.address;
      const memoto = addressAndMemo.memo;
      const account_number = accountInfo.account_number;
      var sequence = accountInfo.sequence;
      sequence += index
      const memo = memoto;
      const type = 'MsgSend';

      const msg = {
        inputs: [{
            address: settlementAddress,
            coins: [{
              denom: transaction.currency,
              // amount: (transaction.amount * Math.pow(10,8)).toFixed()
              amount: Math.round(transaction.amount * Math.pow(10,8))
            }]
        }],
        outputs: [{
            address: to,
            coins: [{
              denom: transaction.currency,
              // amount: (transaction.amount * Math.pow(10,8)).toFixed()
              amount: Math.round(transaction.amount * Math.pow(10,8))
            }]
        }],
        msgType:'MsgSend'
      };
      console.log('msg.inputs:',msg.inputs[0].coins);
      // Update meta hash
      const meta = { account_number , msg , sequence , memo , type , chain_id };
      metas.push (meta);
    })
    return metas;
  }

  parseAmount(amount) {
    const [value, currency] = amount.split(' ');
    return {
      value: new Decimal(value).toFixed(),
      currency: currency.toUpperCase(),
    };
  }

  async derive(wallet, path) {
    const { settlementAddress: address } = wallet;
    const memo = path === this.addresses.path.SETTLEMENT
      ? null
      : utils.generateMemo(path);
    return { address, memo };
  }

  async deriveColdAddress(wallet, path) {
    const { coldSettlementAddress: address } = wallet;
    const memo = path === this.addresses.path.COLDWALLET
      ? null
      : utils.generateMemo(path);
    return { address, memo };
  }

  // Monitor
  async parseAddress(address, memo, trx) {
    const found = (
      // If this has memo
      memo &&
      // Then we lookup as user address first
      await this.addresses
        .findByAddressAndMemoAndService(constants.NAME, address, memo, trx)
    ) ||
      // And fallback to settlement if any above got failed
      // Cause anyway, this is funding to settlement address

      await this.addresses.findSettlement(constants.NAME, address, trx);
  
      console.log("found",found,memo);
      return found && {
      ...found,
      fullAddress: await utils.formatAddressWithMemo(found),
    };
  }

  parseRawTransaction(rawTx) {
    return {
      height: rawTx.blockHeight,
      hash: rawTx.txHash,
      fromAddr :rawTx.fromAddr ,
      toAddr :rawTx.toAddr ,
      value :rawTx.value ,
      txAsset :rawTx.txAsset ,
      memo:rawTx.memo,
    };
  }

  async buildTransferTransaction(data, trx) {
    console.log('*---- BNB_interpreter.buildTransferTransaction ----*')
    // console.log("data",data);
    return {  // Sender & Receiver
      to: data.toAddr,
      from: data.fromAddr,
      toAddress: await this.parseAddress(data.toAddr, data.memo, trx),
      fromAddress: await this.parseAddress(data.fromAddr, null, trx),
      amount: data.value,
    };
  }

  // async buildInterestTransaction(op, trx) {
  //   return {
  //     to: op.owner,
  //     amount: this.parseAmount(op.interest).value,
  //     toAddress: await this.parseAddress(op.owner, null, trx),
  //     feeAmount: '0', // Interest has no fee
  //   };
  // }

  // async buildTransaction(raw, trx) {

  //    return this.buildTransferTransaction(raw.act.data, trx);
  //     // case 'interest':
  //     //   return this.buildInterestTransaction(data, trx);
  // }

  async deserializeTx(raw) {
    return bnbUtils.sha256(raw);
  }

  buildBroadcastedWithdrawals(transaction, response) {
    console.log('*---- BNB_interpreter.buildBroadcastedWithdrawals -----*')
    // From response
    const { hash: transactionHash } = response[0];
    // Constant
    const outputIndex = 0;
    const currency = constants.CURRENCY;

    // const withdrawal = { amount, currency, toAddress, outputIndex, transaction };
    const withdrawal = { currency, outputIndex, transactionHash };
    return [withdrawal]; // We have only 1 withdrawal per broadcasted transaction
  }

  async parseTransaction(raw, blockHeight, trx) {
    console.log('*---- BNB_interpreter.parseTransaction ----*')
    const transaction = await this.buildTransferTransaction(raw, trx);
    const transactionHash =
      // Normal transaction
      raw.hash
    return [{
      ...transaction,
      blockHeight,
      outputIndex: 0,
      transactionHash,
      currency: constants.CURRENCY,
      feeCurrency: constants.FEE_CURRENCY,
    }] ;
  }

  buildInputWithdrawals(transaction) {
   return [];
  }
}

module.exports = BnbInterpreter;
