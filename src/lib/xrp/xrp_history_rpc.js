const fetch = require('node-fetch');
const Decimal = require('decimal.js');
// const debug = require('debug')('wallet:xrp_rpc');
const Api = require('../api');
const Promise = require('bluebird');

class XrpHistoryRpc extends Api {
  constructor({
    xrpNodeV2Url, xrpSleepTime, xrpTimeout,
  }) {
    super({
      baseUrl: xrpNodeV2Url,
      sleepTime: Number(xrpSleepTime),
      maxAttempt: 20,
      timeout: xrpTimeout,
    });
    this.xrpNodeV2Url = xrpNodeV2Url
  }

  async findTransactionsByAddress(address,start,end,marker,attempt=0) {
    try {
      console.log('*---- XRP_history_RPC.findTransactionsByAddress ----*')
      const txs= await this.get(`/v2/accounts/${address}/transactions?type=Payment&result=tesSUCCESS&limit=1000&start=${start}&end=${end}&marker=${marker}`);
      console.log('txs:',txs)
      return {marker : txs.marker , transactions :txs.transactions};
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.findTransactionsByAddress(address,start,end,marker,attempt+1);
    } 
  }

 async getInfoLedger (height){
  try {
    const info = await this.get(`/v2/ledgers/${height}`)
    return info.ledger
  }
  catch(ex) {
    if (attempt >= this.MAX_ATTEMPT) {
      throw Error(`Failed after ${attempt} retries , exit.`);
    }
    await Promise.delay(1000 * this.sleepTime);
    return await this.getInfoLedger(height,attempt+1);
  } 

 }

}

module.exports = XrpHistoryRpc;