const fetch = require('node-fetch');
const Decimal = require('decimal.js');
const debug = require('debug')('wallet:tron_rpc');
const Api = require('../api');
const Promise = require('bluebird');


class TronRpc extends Api {
  constructor({
    tronNodeUrl, tronSleepTime, 
  }) {
    super({
      baseUrl: tronNodeUrl,
      sleepTime: Number(tronSleepTime),
      maxAttempt: 20,
      timeout: 100000,
    });


    // Get retry config
    // 1 TRX = 1,000,000 sun
    this.DECIMALS = 6;
    this.ONE_TRX = new Decimal(1e6);
  
  }

  async getBlock(num, attempt = 0) {
    try {
      return  await this.post("/wallet/getblockbynum",  { num } );
    } catch (err) {
      console.log("exception rpc tron",err);

      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getBlock(num ,attempt+1);    
    }
  }

  async getLatestBlock(attempt = 0) {
    try {
      return  await this.post('/wallet/getnowblock');
    } catch (err) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getLatestBlock(attempt+1);    
    }
  }
}

module.exports = TronRpc;
