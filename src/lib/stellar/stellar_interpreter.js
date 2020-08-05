const Promise = require('bluebird');
const utils = require('../../utils');
const Decimal = require('decimal.js');
const constants = require('./stellar_constants');
const { xdr, Transaction, Operation } = require('stellar-sdk');

class StellarInterpreter {
  constructor({
    address,
    stellarApi,
    STELLAR_ITEM_PER_PAGE,
  }) {
    // Global
    this.addresses = address;

    // Local
    this.api = stellarApi;
    this.currency = constants.CURRENCY;
    this.itemPerPage = Number(STELLAR_ITEM_PER_PAGE);
  }

  async computeMinimumBalance(address) {
    const latestBlock = await this.api.getLatestBlock();
    const account = await this.api.getAccount(address);
    const { subentry_count: subentryCount } = account;
    const numberOfEntries = subentryCount + 2;
    const { base_reserve_in_stroops: costPerEntry } = latestBlock;
    return Decimal(costPerEntry).mul(numberOfEntries).div(constants.XLM_TO_STROOPS).toFixed();
  }

  async getMeta(settlementAddress, transactions , isColdWallet = true) {
    let meta = []
    // Balances hash of settlement address
    const account = await this.api.getAccount(settlementAddress);
    // Current sequence
    var { sequence, balances } = account;
    const asset = constants.ASSET_TYPE_NATIVE;
    await Promise.each (transactions, async (transaction, index) => {
      var addressAndMemo= utils.splitAddressAndMemo(transaction.address);
      var address = addressAndMemo.address
      var memo = addressAndMemo.memo
      var amount = transaction.amount
      meta.push ({address, memo, amount, sequence, asset })
    })
    return meta
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

  async sortTxEntries(rawTxEntries) {
    const txEntries = await Promise.map(
      rawTxEntries,
      async ([externalId, rawTx]) => [externalId, await this.deserializeTx(rawTx)],
    );
    const sortTx = (a, b) => {
      const { sequence: aSequence } = a[1];
      const { sequence: bSequence } = b[1];
      const diff = new Decimal(aSequence).sub(bSequence);
      return diff.div(diff.abs()).toNumber();
    };
    return txEntries.sort(sortTx);
  }

  buildBroadcastedWithdrawals(transaction) {
    const { outputs } = transaction;
    return outputs;
  }

  buildInputWithdrawals(transaction) {
    return [];
  }


  // Broadcast
  async deserializeTx(raw) {
    const buffer = Buffer.from(raw, 'base64');
    const envelope = xdr.TransactionEnvelope.fromXDR(buffer);

    // Get outputs from envelope
    const tx = envelope.tx();
    const outputs = [];
    tx.operations().forEach((xdrOp, outputIndex) => {
      const operation = Operation.fromXDRObject(xdrOp);
      const { destination, amount } = operation;
      if (operation.type === constants.OP_TYPE_PAYMENT) {
        outputs.push({
          amount,
          outputIndex,
          currency: this.getCurrencyOfOperation(operation),
          toAddress: destination,
        });
      }
    });

    // Get transaction from envelope
    const transaction = new Transaction(envelope);
    const { sequence } = transaction;
    const transactionHash = transaction.hash().toString('hex');

    return {
      outputs,
      sequence,
      transaction,
      transactionHash,
    };
  }

  // Monitor
  async parseAddress(address, memo, trx) {
    const found = (
      // If this has memo
      memo && (
        // And we support this memo type
        memo.type === constants.MEMO_TYPE_ID ||
        memo.type === constants.MEMO_TYPE_TEXT
      )
      && memo.value
      // Then we lookup as user address first
      && await this.addresses.findByAddressAndMemoAndService(
        constants.NAME, address, memo.value,
        trx,
      )
    ) ||
      // And fallback to settlement if any above got failed
      // Cause anyway, this is funding to settlement address
      await this.addresses.findSettlement(constants.NAME, address, trx);

    return found && {
      ...found,
      fullAddress: utils.formatAddressWithMemo(found),
    };
  }

  async parseTransaction(rawTransaction, blockHeight, trx) {
    console.log('*---- Stellar.parseTransaction ----*')
    const allOps = await this.getAllTransactionOperations(rawTransaction.hash);
    return Promise.map(allOps, async (op, index) => ({
      blockHeight,
      transactionHash: rawTransaction.hash,
      outputIndex: index,
      from: op.from || op.source_account,
      fromAddress: await this.parseAddress(op.from || op.source_account, null, trx),
      to: op.to || op.account || op.type,
      toAddress: (op.to || op.account)
        ? await this.parseAddress(op.to || op.account, rawTransaction.memo, trx)
        : null,
      currency: this.getCurrencyOfOperation(op),
      contractAddress: op.asset_issuer || null, // Issuer address
      amount: op.amount || op.starting_balance || 0,
      feeCurrency: constants.CURRENCY, // XLM as fee
      feeAmount: new Decimal(rawTransaction.feeAmount)
        .div(rawTransaction.operationCount)
        .div(constants.XLM_TO_STROOPS) // Use stroop as unit
        .toFixed(),
    }));
  }

  getCurrencyOfOperation(op) {
    return (op.asset_type === constants.ASSET_TYPE_NATIVE || !op.asset_code)
      ? constants.CURRENCY // XLM is native
      : op.asset_code;
  }

  async getAllTransactionOperations(hash, previous = null) {
    const current = previous
      ? await previous.next()
      : await this.api.findOperationsByTransaction(hash, this.itemPerPage, 'asc');
    if (current.records.length < this.itemPerPage) return current.records;
    return current.records.concat(await this.getAllTransactionOperations(null, current));
  }

  parseRawTransaction(raw) {
    return {
      hash: raw.hash,
      height: raw.ledger_attr,
      memo: {
        value: raw.memo,
        type: raw.memo_type,
      },
      feeAmount: raw.fee_paid,
      operationCount: raw.operation_count,
    };
  }
}

module.exports = StellarInterpreter;
