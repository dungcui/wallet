const { Address, HDPublicKey, Networks } = require('bitcore-lib');
const constants = require('./usdt_constants');
// const Decimal = require('decimal.js');

class UsdtInterpreter {
  constructor({ address, funding, usdtRpc }) {
    this.addresses = address;
    this.fundings = funding;
    this.api = usdtRpc;
  }

  async derive(wallet, path) {
    const xpub = new HDPublicKey(wallet.xpubs);
    const overridedPath = path.indexOf('m') > -1 ? path : `m/${path}`;
    const address = new Address(xpub.derive(overridedPath).publicKey, Networks.livenet).toString();
    return { address };
  }

  async parseTransaction(transaction, trx) {
    // console.log("transaction.referenceaddress",transaction.referenceaddress);
    // console.log("transaction.valid",transaction.valid);
    if(transaction.referenceaddress)
    return {
      transactionHash: transaction.txid,
      from: transaction.sendingaddress,
      to: transaction.referenceaddress,
      propertyId: transaction.propertyid,
      blockHash: transaction.blockhash,
      blockHeight: transaction.block,
      outputIndex: transaction.positioninblock,
      amount: Number(transaction.amount),
      currency: constants.CURRENCY,
      feeCurrency: constants.FEE_CURRENCY,
      feeAmount: Number(transaction.fee),
      valid: transaction.valid,
      fromAddress:
        (await this.addresses.findByAddressAndService(constants.NAME,transaction.sendingaddress, trx)) || null,
      toAddress:
        (await this.addresses.findByAddressAndService(constants.NAME,transaction.referenceaddress, trx)) || null,
    };
  }
  buildBroadcastedWithdrawals(transaction) {
    return [
      {
        amount: Number(transaction.amount),
        transactionHash: transaction.transactionHash,
        currency: constants.CURRENCY,
        toAddress: transaction.referenceaddress,
        fromAddress: transaction.sendingaddress,
        outputIndex: 0,
      },
    ];
  }

  async deserializeTx(raw) {
    const rawTx = await this.api.decodeRawTx(raw);
    return {
      transactionHash: rawTx.txid,
      ...rawTx,
    };
  }

  async getMeta(wallet) {
    return { walletId: wallet.id };
  }
}

module.exports = UsdtInterpreter;
