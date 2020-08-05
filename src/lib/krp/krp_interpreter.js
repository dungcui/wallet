const Promise = require('bluebird');
const Decimal = require('decimal.js');
const utils = require('../../utils');
const constants = require('./krp_constants');
const debug = require('debug')('wallet:worker');
const SPACE = ' ';
const transactionCreator = require('./krp_transaction_creator')


class KrpInterpreter {
  constructor({ db, address, krpApi ,krpTokenAccount , krpPublicHotKey, krpPublicColdKey }) {
    this.db = db;
    this.api = krpApi;
    this.addresses = address;
    this.krpTokenAccount = krpTokenAccount;
    this.krpPublicHotKey = krpPublicHotKey;
    this.krpPublicColdKey = krpPublicColdKey;

  }

  

  getNetworkAmount(amount) {
    // 100 => "100 SPHTX"
    return [
      new Decimal(amount).mul(1.0000).toFixed(4),
      constants.CURRENCY,
    ].join(SPACE);
  }

  increaseExpiration(expiration, durationInMs) {
    const newExpiration = new Date(new Date(expiration).getTime() + durationInMs).toISOString();
    return newExpiration.slice(0, newExpiration.length - 1);
  }

  async getMeta(wallet, transactions, isColdWallet = true) {
    let meta = [];
    await Promise.each(transactions, async (inputTx) => {
      // Build operation from inputTx

      const { head_block_num ,chain_id } = await this.api.getInfo();
      
      const { ref_block_prefix } = await this.api.getBlock(head_block_num);
      let from = "";
      if(!isColdWallet) {
        from = wallet.settlementAddress;
      } else {
        from = wallet.coldSettlementAddress;

      }
      const { id, address: formatedAddress } = inputTx;
      const addressAndMemo = utils.splitAddressAndMemo(formatedAddress);
      const to = addressAndMemo.address;
      const memo = addressAndMemo.memo;
      const amount = this.getNetworkAmount(inputTx.amount);
      // const fee = this.getNetworkAmount(constants.BASE_FEE);
      const expiration = this.increaseExpiration(new Date().getTime(), 3600 * 1000);
      let ref_block_num =head_block_num & 0xffff;
      const method ="transfer";

      const operation = { chain_id,ref_block_num  , ref_block_prefix , expiration , method , to, from, amount, memo };
      let requiredKeys = [];
      if(!isColdWallet)
      {
        requiredKeys [0] = this.krpPublicHotKey;
      } else 
      {
        requiredKeys [0] = this.krpPublicColdKey;
      }
      // Get transaction and digest from network
      const networkTx = await transactionCreator.createSimpleTransaction(operation);
      const transaction = {
        id,
        ...networkTx,
        chain_id,
        requiredKeys,
      };

      // const digest = await this.api.getTransactionDigest(transaction);

      // Update meta hash
      
      meta.push({ transaction });
    });
    return meta;
  }


  parseAmount(amount) {
    const [value, currency] = amount.split(' ');
    if(value && currency)
    {
      return {
        value: new Decimal(value).toFixed(),
        currency: currency.toUpperCase(),
      };
    } else {
      return {
        value: 0,
        currency: '',
      };
    }

  }

  async derive(wallet, path) {
    const { settlementAddress: address } = wallet;
    const memo = path === this.addresses.path.SETTLEMENT
      ? null
      : utils.generateMemo(path)
    return { address, memo };
  }

  async deriveColdAddress(wallet, path) {
    const { coldSettlementAddress: address } = wallet;
    const memo = (path === this.addresses.path.SETTLEMENT || path === this.addresses.path.COLDWALLET)
      ? null
      : utils.generateMemo(path)
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
    return found && {
      ...found,
      fullAddress: utils.formatAddressWithMemo(found),
    };
  }

  parseRawTransaction(rawTx) {
    console.log("aa",rawTx.action_trace.act.account);
    return {
      account : rawTx.action_trace.act.account,
      height: rawTx.block_num,
      hash: rawTx.action_trace.trx_id,
      ...rawTx.action_trace,
    };
  }

  async buildTransferTransaction(data, trx) {
    console.log(data);
    return {
      
      // Sender & Receiver
      to: data.to,
      from: data.from,
      toAddress: await this.parseAddress(data.to, data.memo, trx),
      fromAddress: await this.parseAddress(data.from, null, trx),
      // Value and fee
      amount: this.parseAmount(data.quantity).value,
      // feeAmount: this.parseAmount(op.fee).value,
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

  async buildTransaction(raw, trx) {

     return this.buildTransferTransaction(raw.act.data, trx);
      // case 'interest':
      //   return this.buildInterestTransaction(data, trx);
  }

  async deserializeTx(raw) {
    return new Uint8Array(raw)
  }

  async buildBroadcastedWithdrawals(transaction, response) {
    // From response
    console.log("response 2",response);
    // const { transaction_id: transactionHash } = response;

    const withdrawal = { amount:transaction.amount, currency:transaction.currency , toAddress : transaction.address, outputIndex : 0, transactionHash : response };
    return [withdrawal]; // We have only 1 withdrawal per broadcasted transaction
  }

  buildInputWithdrawals(transaction) {
    return [];
  }

  async parseTransaction(raw, blockHeight, trx) {
    const transaction = await this.buildTransaction(raw, trx);
    const transactionHash =
      // Normal transaction
      raw.trx_id 
    return [{
      ...transaction,
      blockHeight,
      outputIndex: 0,
      transactionHash,
      currency: this.parseAmount(raw.act.data.quantity).currency,
      feeCurrency: constants.FEE_CURRENCY,
    }] ;
  }

  
 
  
}

module.exports = KrpInterpreter;
