const Promise = require('bluebird');
const Monitor = require('../monitor');
const constants = require('./krp_constants');
const { rangeToArray } = require('../../utils');
const debug = require('debug')('wallet:worker');


class KrpMonitor extends Monitor {
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
    krpApi: api,
    krpInterpreter: interpreter,

    // Environment variables
    KRP_ITEM_PER_PAGE : itemPerPage,

    KRP_SLEEP_TIME: sleepTime,
    KRP_START_BLOCK_HEIGHT: startBlockHeight,
    KRP_MINIMUM_CONFIRMATIONS: minimumConfirmation,
    KRP_TOKEN_ACCOUNT : krpTokenAccount,
    // KRP_ACCOUNT_NAME : krpAccountName,

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
    this.itemPerPage = itemPerPage;

    this.wallets = wallet;
    this.currency = constants.CURRENCY;
    this.krpTokenAccount = krpTokenAccount;
    // this.krpAccountName = krpAccountName;
  }


  async getAllAddressTransactions(address, startHeight, itemsPerPage) {
    var records = await this.api.findTransactionsByAddress(address, itemsPerPage)
    // console.log("records",records[0].action_trace);
    if(records.length)
    {
      const [minBlock, maxBlock] =
        [0, records.length - 1].map(index => records[index]);
      // this.debug(`Search from ${maxBlock.block} down to ${minBlock.block} of ${address}`);
      if (minBlock.block_num >= startHeight && records.length == itemsPerPage) {
        itemsPerPage += this.itemPerPage;
        records = await this.getAllAddressTransactions(address, startHeight, itemsPerPage);
      }
      return records
    } else 
    {
      return [];
    }
  }


  async buildTxsMap(fromHeight, toHeight) {
    // Get all settlement addresses to fetch
    const wallets = await this.wallets.findAllByService(this.name);
    const addresses = wallets.map(address => address.settlementAddress);

    // Fetch transactions off all addresses
    // Use txsMap to keep only one tx from all with same hash
    // Use blocksMap to collect txs with same height
    const txsMap = new Map();
    console.log("this.eosTokenAccount",this.krpTokenAccount);

    await Promise.each(
      addresses,
      async address => (await this.getAllAddressTransactions( address, fromHeight, this.itemPerPage))
        .map(this.interpreter.parseRawTransaction)
        .filter(tx => tx.account === this.krpTokenAccount)
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

module.exports = KrpMonitor;
