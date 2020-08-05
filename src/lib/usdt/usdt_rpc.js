const jayson = require('jayson');
const Promise = require('bluebird');

class UsdtRpc {
  constructor({ usdtNodeUrl }) {
    this.nodeUrl = usdtNodeUrl;
    this.sleepTime=10;
    this.MAX_ATTEMPT =1;
    if (!this.nodeUrl) {
      throw Error('Please provide USDT_NODE_URL');
    }
    this.client = Promise.promisifyAll(jayson.client.http(this.nodeUrl));
  }

  async getTxsByHeight(height ,attempt=0) {
    try {
      return (await this.client.requestAsync('omni_listblocktransactions', [height])).result;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.getTxsByHeight(height ,attempt+1);
    }
  
  }

  async getRawTx(txHash,attempt=0) {
    try {
      return (await this.client.requestAsync('omni_gettransaction', [txHash])).result;
    }catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.getRawTx(txHash ,attempt+1);
    }
  }

  async decodeRawTransaction(rawTransaction,attempt=0) {
    try {
      return (await this.client.requestAsync('omni_decodetransaction', [rawTransaction])).result;
    }catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.decodeRawTransaction(rawTransaction ,attempt+1);
    }
  }

  async decodeRawTx(rawTx,attempt=0) {
    try {
      return (await this.client.requestAsync('decoderawtransaction', [rawTx])).result;
    }catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.decodeRawTx(rawTx ,attempt+1);
    }
  }

  async getLatestBlockHeight(attempt=0) {
    try
    { 
       return (await this.client.requestAsync('omni_getinfo', [])).result.block;
    }catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.getLatestBlockHeight(attempt+1);
    }
  }

  async broadcast(hex ,attempt=0) {
    try
    { 
      return (await this.client.requestAsync('sendrawtransaction', [hex])).result;
    }catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.broadcast(hex, attempt+1);
    }
  }
}

module.exports = UsdtRpc;
