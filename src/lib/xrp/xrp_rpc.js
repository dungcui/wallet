const jayson = require('jayson');
const Promise = require('bluebird');

class XrpRpc {
  constructor({ xrpNodeUrl }) {
    this.nodeUrl = xrpNodeUrl;
    this.sleepTime=10;
    this.MAX_ATTEMPT =20;
    if (!this.nodeUrl) {
      throw Error('Please provide XRP_NODE_URL');
    }
    this.client = Promise.promisifyAll(jayson.client.http(this.nodeUrl));
  }

  async getLedgerByIndex(index ,attempt=0) {
    try {
      return (await this.client.requestAsync('ledger', [{ ledger_index: index, transactions: true }]))
      .result.ledger;   
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getLedgerByIndex(index ,attempt+1);
    }
    
  }

  async getRawTx(txHash ,attempt=0) {
    try {
      return (await this.client.requestAsync('tx', [{ transaction: txHash }])).result;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getRawTx(txHash ,attempt+1);
    }
  }

  async getLatestBlockHeight(attempt=0) {
    try {
      return (await this.client.requestAsync('ledger_current', [{}])).result.ledger_current_index;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getLatestBlockHeight(attempt+1);
    }
  }

  async broadcast(hex ,attempt=0) {
    try {
      return (await this.client.requestAsync('submit', [{ tx_blob: hex }])).result;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.broadcast(hex, attempt+1);
    }
  }

  async getAccountInfo(address ,attempt=0) {
    try {
      return (await this.client.requestAsync('account_info', [{ account: address }])).result
      .account_data;  
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getAccountInfo(address, attempt+1);
    }
  }
}

module.exports = XrpRpc;
