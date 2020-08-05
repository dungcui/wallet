const jayson = require('jayson');
const Promise = require('bluebird');

class BsvRpc {
  constructor({ bsvNodeUrl }) {
    this.nodeUrl = bsvNodeUrl;
    this.sleepTime=10;
    this.MAX_ATTEMPT =20;
    if (!this.nodeUrl) {
      throw Error('Please provide BTC_NODE_URL');
    }
    this.client = Promise.promisifyAll(jayson.client.http(this.nodeUrl));
  }

  async getBlock(blockHash, raw,  attempt = 0) {
    try {
      return (await this.client.requestAsync('getblock', [blockHash, !raw])).result;
    }
    catch(ex)
    {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getBlock(blockHash, raw,attempt+1);
    }
  }

  async getBlockHashByHeight(height,  attempt = 0) {
    try {
      return (await this.client.requestAsync('getblockhash', [height])).result;
    }
    catch(ex)
    {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getBlockHashByHeight(height,attempt+1);
    }
  }

  async getRawTx(txHash, verbose = 1,  attempt = 0) {
    try {
      return (await this.client.requestAsync('getrawtransaction', [txHash, verbose])).result;
    }
    catch(ex)
    {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.getRawTx(txHash, verbose , attempt+1);
    }
    
  }

  async decodeRawTransaction(rawTransaction,  attempt = 0) {
    try {
      return (await this.client.requestAsync('decoderawtransaction', [rawTransaction])).result;
    }
    catch(ex)
    {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.decodeRawTransaction(rawTransaction, attempt+1);
    }
  }

  async getLatestBlockHeight( attempt = 0) {
    try {
      return (await this.client.requestAsync('getblockcount', [])).result;
    }
    catch(ex)
    {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getLatestBlockHeight(attempt+1);
    }
  }

  async broadcast(hex,attempt = 0) {
    try {
      return (await this.client.requestAsync('sendrawtransaction', [hex])).result;
    }
    catch(ex)
    {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.broadcast(hex,attempt+1);
    }
  }
}

module.exports = BsvRpc;
