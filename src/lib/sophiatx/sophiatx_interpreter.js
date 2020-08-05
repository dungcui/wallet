const Promise = require('bluebird');
const Decimal = require('decimal.js');
const utils = require('../../utils');
const constants = require('./sophiatx_constants');

const SPACE = ' ';

class SophiatxInterpreter {
  constructor({ db, address, sophiatxApi }) {
    this.db = db;
    this.api = sophiatxApi;
    this.addresses = address;
  }

  getNetworkAmount(amount) {
    // 100 => "100 SPHTX"
    return [
      new Decimal(amount).toFixed(),
      constants.CURRENCY,
    ].join(SPACE);
  }

  increaseExpiration(expiration, durationInMs) {
    const newExpiration = new Date(new Date(expiration).getTime() + durationInMs).toISOString();
    return newExpiration.slice(0, newExpiration.length - 1);
  }

  async getMeta(wallet, transactions) {
    const meta = {};
    await Promise.each(transactions, async (inputTx) => {
      // Build operation from inputTx
      const from = wallet.settlementAddress;
      const { id, toAddress: to } = inputTx;
      const memo = inputTx.memo.value;
      const amount = this.getNetworkAmount(inputTx.grossAmount);
      const fee = this.getNetworkAmount(constants.BASE_FEE);
      const operation = ['transfer', { fee, to, from, amount, memo }];

      // Get transaction and digest from network
      const networkTx = await this.api.createSimpleTransaction(operation);
      const transaction = {
        ...networkTx,
        expiration: this.increaseExpiration(networkTx.expiration, 3600 * 1000),
      };

      const digest = await this.api.getTransactionDigest(transaction);

      // Update meta hash
      meta[id] = { transaction, digest };
    });
    return JSON.stringify(meta);
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
      : utils.nextId(address, path);
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
    return {
      height: rawTx.block,
      hash: rawTx.trx_id,
      ...rawTx,
    };
  }

  async buildTransferTransaction(op, trx) {
    return {
      // Sender & Receiver
      to: op.to,
      from: op.from,
      toAddress: await this.parseAddress(op.to, op.memo, trx),
      fromAddress: await this.parseAddress(op.from, null, trx),

      // Value and fee
      amount: this.parseAmount(op.amount).value,
      feeAmount: this.parseAmount(op.fee).value,
    };
  }

  async buildInterestTransaction(op, trx) {
    return {
      to: op.owner,
      amount: this.parseAmount(op.interest).value,
      toAddress: await this.parseAddress(op.owner, null, trx),
      feeAmount: '0', // Interest has no fee
    };
  }

  async buildTransaction(raw, trx) {
    const [method, op] = raw.op;
    switch (method) {
      case 'transfer':
        return this.buildTransferTransaction(op, trx);
      case 'interest':
        return this.buildInterestTransaction(op, trx);
      default:
        return {};
    }
  }

  async deserializeTx(raw) {
    return JSON.parse(Buffer.from(raw, 'hex').toString('utf8'));
  }

  buildBroadcastedWithdrawals(transaction, response) {
    // From response
    const { transaction_id: transactionHash } = response;

    // From operation
    const [[, operation]] = transaction.operations;
    const amount = new Decimal(operation.amount.split(' ')[0]).toFixed();
    const { to: toAddress } = operation;

    // Constant
    const outputIndex = 0;
    const currency = constants.CURRENCY;

    const withdrawal = { amount, currency, toAddress, outputIndex, transactionHash };
    return [withdrawal]; // We have only 1 withdrawal per broadcasted transaction
  }

  buildInputWithdrawals(transaction) {
    const { vin } = transaction;
    return vin.map(input => ({
      txid : input.txid,
      vout : input.vout,
    }));
  }

  async parseTransaction(raw, blockHeight, trx) {
    const transaction = await this.buildTransaction(raw, trx);
    const transactionHash =
      // Normal transaction
      raw.trx_id ||
      // Virtual transaction (ref: SophiaTx team)
      Buffer.from(raw.id).toString('hex').padStart(40, '0');
    return transaction ? [{
      ...transaction,
      blockHeight,
      outputIndex: 0,
      transactionHash,
      currency: constants.CURRENCY,
      feeCurrency: constants.FEE_CURRENCY,
    }] : [];
  }
}

module.exports = SophiatxInterpreter;
