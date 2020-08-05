const Promise = require('bluebird');
const Monitor = require('../monitor');
const constants = require('./sophiatx_constants');

class SophiatxMonitor extends Monitor {
  constructor({
    db,
    block,
    token,
    wallet,
    funding,
    withdrawal,
    failedApi,
    limit,
    // Local components
    sophiatxApi: api,
    sophiatxInterpreter: interpreter,

    // Environment variables
    SOPHIATX_ITEM_PER_PAGE,
    SOPHIATX_SLEEP_TIME: sleepTime,
    SOPHIATX_START_BLOCK_HEIGHT: startBlockHeight,
    SOPHIATX_MINIMUM_CONFIRMATION: minimumConfirmation,

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

    this.wallets = wallet;
    this.currency = constants.CURRENCY;
    this.itemPerPage = SOPHIATX_ITEM_PER_PAGE;
  }

  async getAllAddressTransactions(address, startHeight, startIndex = -1) {
    const records =
      (await this.api.findTransactionsByAddress(address, startIndex, this.itemPerPage))
        .map(([id, transaction]) => ({ id, ...transaction }));

    // Logging search range
    const [minBlock, maxBlock] =
      [0, records.length - 1].map(index => records[index]);
    this.debug(`Search from ${maxBlock.block} down to ${minBlock.block} of ${address}`);

    const nextIndex = minBlock.id - 1;

    const nextRecords = (
      // If we reach last page
      records.length < this.itemPerPage ||
      // Or all blocks is smaller than startHeight (we've processed all of them)
      maxBlock.block < startHeight
    ) ? [] // Then there is no further records
      : await this.getAllAddressTransactions(address, startHeight, nextIndex);

    return [...records, ...nextRecords];
  }

  async buildTxsMap(fromHeight, toHeight) {
    // Get all settlement addresses to fetch
    const wallets = await this.wallets.findAllByService(this.name);
    const addresses = wallets.map(address => address.settlementAddress);

    // Fetch transactions off all addresses
    // Use txsMap to keep only one tx from all with same hash
    // Use blocksMap to collect txs with same height
    const txsMap = new Map();
    await Promise.each(
      addresses,
      async address => (await this.getAllAddressTransactions(address, fromHeight))
        .map(this.interpreter.parseRawTransaction)
        .filter(tx => tx.height >= fromHeight && tx.height <= toHeight)
        .forEach(tx => txsMap.set(tx.hash, tx)),
    );
    return txsMap;
  }

  async buildBlocksMap(txsMap, fromHeight, toHeight) {
    const blocksMap = new Map();
    txsMap.forEach(tx => blocksMap.set(
      tx.height,
      (blocksMap.get(tx.height) || []).concat(tx),
    ));

    // Set a virtual block for height = toHeight
    // Because there is no transactions there
    if (!blocksMap.get(toHeight)) blocksMap.set(toHeight, []);
    return blocksMap;
  }

  async fetchRange(fromHeight, toHeight) {
    const txsMap = await this.buildTxsMap(fromHeight, toHeight);
    const blocksMap = await this.buildBlocksMap(txsMap, fromHeight, toHeight);
    await Promise.each(
      Array.from(blocksMap.keys()).sort(),
      async (height) => {
        const rawTransactions = blocksMap.get(height);
        const transactions = [];
        await Promise.each(
          rawTransactions,
          async rawTx => transactions
            .push(...await this.interpreter.parseTransaction(rawTx, height)),
        );
        this.nextBlocks.push({ height, transactions });
      },
    );
  }
}

module.exports = SophiatxMonitor;
