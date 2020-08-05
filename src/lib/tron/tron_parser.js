const Decimal = require('decimal.js');
const tronUtils = require('./tron_utils');

class TronParser {
  constructor({ tronAddress }) {
    this.addresses = tronAddress;
    this.ONE_TRX = new Decimal(1e6);
  }

  isUserFundingTransaction(tx) {
    return (
      tx.toAddress &&
      tx.toAddress.type === this.addresses.type.USER
    );
  }

  async fetchAddress(tx, trx) {
    return {
      ...tx,
      toAddress: await this.addresses.load({ hash: tx.to }, trx),
    };
  }

  static isTransferTransaction(tx) {
    return tx.raw_data.contract[0].type === 'TransferContract';
  }

  static parseTransaction(raw) {
    const { parameter, type } = raw.raw_data.contract[0];
    return {
      type,
      hash: raw.txID,
      amount: parameter.value.amount,
      to: tronUtils.getBase58CheckAddress(parameter.value.to_address),
      from: tronUtils.getBase58CheckAddress(parameter.value.owner_address),
    };
  }

  parseBlock(raw) {
    return {
      hash: raw.blockID,
      height: raw.block_header.raw_data.number || 0,
      transactions: raw.transactions
        ? raw.transactions
          .filter(this.constructor.isTransferTransaction)
          .map(this.constructor.parseTransaction)
        : [],
    };
  }
}

module.exports = TronParser;
