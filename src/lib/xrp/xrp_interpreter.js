const constants = require('./xrp_constants');
const binary = require('ripple-binary-codec');
const Promise = require('bluebird');
const utils = require('../../utils');

class XrpInterpreter {
  constructor({ address, funding, xrpRpc, xrpApi }) {
    this.addresses = address;
    this.fundings = funding;
    this.api = xrpRpc;
    this.transApi = xrpApi;
  }

  async derive(wallet, path) {
    const { settlementAddress: address } = wallet;
    const memo = path === this.addresses.path.SETTLEMENT
      ? null // Settlement has no memo
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

  parseRawTransaction(rawTx) {
    return {
      height: rawTx.ledger_index,
      hash: rawTx.hash,
      fromAddr :rawTx.tx.Account ,
      toAddr :rawTx.tx.Destination ,
      value : parseInt(rawTx.tx.Amount)/Math.pow(10,6),
      txAsset :rawTx.txAsset ,
      memo:rawTx.tx.DestinationTag,
    };
  }

  async buildTransferTransaction(data, trx) {
    // console.log("data",data);
    return {  // Sender & Receiver
      to: data.toAddr,
      from: data.fromAddr,
      toAddress: await this.parseAddress(data.toAddr, data.memo, trx),
      fromAddress: await this.parseAddress(data.fromAddr, null, trx),
      amount: data.value,
    };
  }

  buildInputWithdrawals(transaction) {
    return [];
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
    const transaction = await this.buildTransferTransaction(raw, trx);
    // console.log("raw",raw);
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
      feeAmount: constants.BASE_FEE
    }] ;
  }

   async parseAddress(address, memo, trx) {
    const found = (
      // If this has memo
      memo &&
      // Then we lookup as user address first
      await this.addresses
        .findByAddressAndMemoAndService(constants.NAME, address, memo, trx)
    ) ||
      await this.addresses.findSettlement(constants.NAME, address, trx);

    return found && {
      ...found,
      fullAddress: await utils.formatAddressWithMemo(found),
    };
  }

  buildBroadcastedWithdrawals(transaction) {
    return [
      {
        amount: Number(transaction.Balance),
        transactionHash: transaction.transactionHash,
        currency: constants.CURRENCY,
        toAddress: transaction.Destination,
        fromAddress: transaction.Account,
        outputIndex: 0,
      },
    ];
  }

  deserializeTx(raw, txId) {
    const tx = binary.decode(raw);

    return {
      ...tx,
      transactionHash: txId,
    };
  }

  async getMeta(wallet, transactions, isColdWallet = true) {
    let meta = [];
    // console.log(this.transApi);
    await Promise.each(transactions, async (inputTx,index) => {
      // Build operation from inputTx
      var from = "";
      if (isColdWallet){
        from = wallet.coldSettlementAddress;
      } else {
        from = wallet.settlementAddress;
      }
      const { id, address: formatedAddress } = inputTx;
      const andressAndMemo = utils.splitAddressAndMemo(formatedAddress);
      const to = andressAndMemo.address;
      const memo = andressAndMemo.memo;
      const amount = inputTx.amount;
      const txJSON = await this.transApi.getSimpleTransactions(from,amount,to,memo);
      const transaction = JSON.parse(txJSON);
      transaction.Sequence += index;
      meta.push(transaction);
    });
    // return JSON.stringify(meta);
    return meta;
  }

}

module.exports = XrpInterpreter;
