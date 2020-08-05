const jayson = require('jayson');
const Promise = require('bluebird');

class NeoRpc {
  constructor({ neoNodeUrl }) {
    this.nodeUrl = neoNodeUrl;
    this.sleepTime=10;
    this.MAX_ATTEMPT =20;
    if (!this.nodeUrl) {
      throw Error('Please provide NEO_NODE_URL');
    }
    this.client = Promise.promisifyAll(jayson.client.http(this.nodeUrl));
  }

  async getBlock(blockHash, raw ,attempt=0) {
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

  async getBlock(blockIndex, verbose ,attempt=0) {
    try {
      return (await this.client.requestAsync('getblock', [blockIndex, verbose])).result;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getBlock(blockIndex, verbose ,attempt+1);
    }
  }

  async getBlockHashByHeight(height ,attempt=0) {
    try {
      return (await this.client.requestAsync('getblockhash', [height])).result;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getBlockHashByHeight(height ,attempt+1);
    }
  }

  async decodeRawTransaction(rawTransaction ,attempt=0) {
    try {
      return (await this.client.requestAsync('decoderawtransaction', [rawTransaction])).result;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.decodeRawTransaction(rawTransaction ,attempt+1);
    }
  }

  async getLatestBlockHeight(attempt=0) {
    try {
      return (await this.client.requestAsync('getblockcount', [])).result;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getLatestBlockHeight(attempt+1);
    }
  }

  async broadcast(hex,attempt=0) {
    try {
      return (await this.client.requestAsync('sendrawtransaction', [hex])).result;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.broadcast(hex,attempt+1);
    }
  }

  async validateAddress(hex,attempt=0) {
    try {
      return (await this.client.requestAsync('validateaddress', [hex])).result;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.validateAddress(hex,attempt+1);
    }
  }

  async getNewAddress(params, id ,attempt=0) {
    try {
      return (await this.client.requestAsync('getnewaddress', [params], id)).result;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getNewAddress(params, id ,attempt+1);
    }
  }

  async getPrivateKey(params, id ,attempt=0) {
    try {
      return (await this.client.requestAsync('dumpprivkey', [params], id)).result;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getPrivateKey(params, id ,attempt+1);
    }
  }

  async getUnspents(address,attempt=0) {
    try {
      return (await this.client.requestAsync('getunspents', [address])).result;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getUnspents(address,attempt+1);
    }
  }
}

module.exports = NeoRpc;
