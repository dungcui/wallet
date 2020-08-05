const Promise = require('bluebird');
const Monitor = require('../monitor');
const constants = require('./xrp_constants');
const { rangeToArray } = require('../../utils');
const debug = require('debug')('wallet:worker');


class XrpMonitor extends Monitor {
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
    xrpRpc: api,
    xrpHistoryRpc ,
    xrpInterpreter: interpreter,

    // Environment variables
    XRP_ITEM_PER_PAGE : itemPerPage,
    XRP_SLEEP_TIME: sleepTime,
    XRP_START_BLOCK_HEIGHT: startBlockHeight,
    XRP_MINIMUM_CONFIRMATIONS: minimumConfirmation,

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
    this.xrpHistoryRpc=xrpHistoryRpc;
  }
  
  async getAllAddressTransactions(address, startHeight, startTimeQuery,endTimeQuery, startIndex = -1,marker='') {
    // console.log("aaaaaa",/address);
    console.log("start",startTimeQuery);
    console.log("end",endTimeQuery);
    const history =(await this.xrpHistoryRpc.findTransactionsByAddress(address,startTimeQuery,endTimeQuery,marker));
    const records =history.transactions;
    console.log("records",records);
    if(records.length >0)
      {
      const [minBlock, maxBlock] =
        [0, records.length - 1].map(index => records[index]);
      this.debug(`Search from ${maxBlock.ledger_index} down to ${minBlock.ledger_index} of ${address}`);

      const nextIndex = minBlock.id - 1;
      console.log("maxBlock.ledger_index",maxBlock.ledger_index);
      console.log("startHeight",startHeight);
      console.log("a",records.length);


      const nextRecords = (
        // If we reach last page
        records.length < this.itemPerPage ||
        // Or all blocks is smaller than startHeight (we've processed all of them)
        maxBlock.ledger_index < startHeight
      ) ? [] // Then there is no further records
        : await this.getAllAddressTransactions(address, startHeight, startTimeQuery,endTimeQuery,nextIndex,history.marker);

      return [...records, ...nextRecords];
      
    } else 
    {
      return [];

    }
  }

  async buildTxsMap(fromHeight, toHeight) {
    // Get all settlement addresses to fetch
    // const block = await this.blocks.get(this.name);
    // const info = await this.xrpHistoryRpc.getInfoLedger(fromHeight);
    // update API get Ledger
    const info = await this.getInfoAgain(fromHeight-1);
    console.log("close_time_human",info.close_time_human);
    const startTimeQuery = new Date(info.close_time_human).toISOString(); 
    // const startTimeQuery = new Date(block.updatedAt).toISOString(); 
    const endTimeQuery = new Date().toISOString();
    console.log("start:",startTimeQuery);
    console.log("end:",endTimeQuery);
    const wallets = await this.wallets.findAllByService(this.name);
    const addresses = wallets.map(address => address.settlementAddress);
    // Fetch transactions off all addresses
    // Use txsMap to keep only one tx from all with same hash
    // Use blocksMap to collect txs with same height
    // console.log("wallets",wallets);
    const txsMap = new Map();
    await Promise.each(
      addresses,
      async address => (await this.getAllAddressTransactions(address,fromHeight,startTimeQuery,endTimeQuery))
        .map(this.interpreter.parseRawTransaction)
        .filter(tx => tx.height >= fromHeight && tx.height <= toHeight)
        .forEach(tx => txsMap.set(tx.hash, tx)),
    );
    console.log("txsMap",txsMap);
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
    // console.log("txsMap",txsMap);
    const blocksMap = await this.buildBlocksMap(txsMap, fromHeight, toHeight);
    // console.log("blocksMap",b/locksMap);
    await Promise.each(
      Array.from(blocksMap.keys()).sort(),
      async (height) => {
        const rawTransactions = blocksMap.get(height);
        // console.log("rawTransactions",rawTransactions);
        const transactions = [];
        await Promise.each(
          rawTransactions,
          async rawTx => transactions
            .push(...await this.interpreter.parseTransaction(rawTx, height)),
        );
        // console.log("transactions777",transactions);
        this.nextBlocks.push({ height, transactions });
      },
    );
  }

  async getInfoAgain(fromHeight)
  {
    let info = await this.api.getLedgerByIndex(fromHeight);
    if (!info || !info.close_time_human) {
      Promise.delay(1000 * this.sleepTime);
      info = await this.getInfoAgain(fromHeight);
    }
    return info;
  }
}

module.exports = XrpMonitor;
