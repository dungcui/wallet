const Promise = require('bluebird');
const Monitor = require('../monitor');
const constants = require('./stellar_constants');

class StellarMonitor extends Monitor {
  constructor({
    db,
    block,
    token,
    wallet,
    funding,
    withdrawal,
    failedApi,
    limit,
    stellarApi: api,
    STELLAR_ITEM_PER_PAGE,
    STELLAR_SLEEP_TIME: sleepTime,
    stellarInterpreter: interpreter,
    STELLAR_START_BLOCK_HEIGHT: startBlockHeight,
    STELLAR_MINIMUM_CONFIRMATION: minimumConfirmation,
  }) {
    const { NAME: name } = constants;
    super({
      db,
      api,
      name,
      block,
      token,
      interpreter,
      funding,
      withdrawal,
      failedApi,
      limit,
      sleepTime,
      startBlockHeight,
      minimumConfirmation,
    });
    // Native currency only
    this.currency = constants.CURRENCY;
    this.itemPerPage = Number(STELLAR_ITEM_PER_PAGE);
    this.wallets = wallet;
  }

  async getAllAddressTransactions(address, startHeight, previous = null) {
    const current = previous
      // If we got previous, just take its next (current = next of previous)
      ? await previous.next()
      // Otherwise, we query transactions from latest to beginning
      : await this.api.findTransactionsByAddress(address, this.itemPerPage, 'desc');

    // Logging search range
    const [minHeight, maxHeight] =
      [0, current.records.length - 1].map(index => current.records[index].ledger_attr);
    this.debug(`Search from ${maxHeight} to ${minHeight} of ${address}`);

    const nextRecords = (
      // If we reach last page
      current.records.length < this.itemPerPage ||
      // Or all blocks is smaller than startHeight (we've processed all of them)
      maxHeight < startHeight
    ) ? [] // Then there is no further records
      : await this.getAllAddressTransactions(address, startHeight, current);

    return current.records.concat(nextRecords);
  }

  filterSupportedCurrencyTransactions(transactions) {
    return transactions
      .filter(transaction =>
        transaction.currency === this.currency ||
        this.tokens.isEnabled(
          this.name,
          transaction.currency,
          transaction.contractAddress,
        ));
  }

  async fetchRange(fromHeight, toHeight) {
    // Get all settlement addresses to fetch
    const wallets = await this.wallets.findAllByService(this.name);
    const addresses = wallets.map(address => address.settlementAddress);

    // Fetch transactions off all addresses
    // Use txsMap to keep only one tx from all with same hash
    // Use blocksMap to collect txs with same height
    const txsMap = new Map();
    const blocksMap = new Map();
    await Promise.each(addresses, async address =>
      (await this.getAllAddressTransactions(address, fromHeight))
        .map(this.interpreter.parseRawTransaction)
        .filter(tx => tx.height >= fromHeight && tx.height <= toHeight)
        .forEach(tx => txsMap.set(tx.hash, tx)));

    txsMap.forEach(tx =>
      blocksMap.set(
        tx.height,
        (blocksMap.get(tx.height) || []).concat(tx),
      ));

    // Set a virtual block for height = toHeight
    // Because there is no transactions there
    if (!blocksMap.get(toHeight)) blocksMap.set(toHeight, []);

    await Promise.each(
      Array.from(blocksMap.keys()).sort((a, b) => a - b),
      async (height) => {
        const rawTransactions = blocksMap.get(height);

        // There might have many wallet transactions in a network transaction
        const allTransactions = [];
        await Promise.each(
          rawTransactions,
          async rawTx => allTransactions
            .push(...await this.interpreter.parseTransaction(rawTx, height)),
        );
        const block = await this.api.getBlock(height);
        const transactions = this.filterSupportedCurrencyTransactions(allTransactions);
        this.nextBlocks.push({ hash: block.hash, height, transactions });
      },
    );
  }
}

module.exports = StellarMonitor;
