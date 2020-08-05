const Api = require('../api');
const Decimal = require('./vet_utils').decimal();
const _ = require('lodash');
const { thorify } = require("thorify"); ;
const Web3 = require("web3");	
const Promise = require('bluebird');

class VetApi extends Api {
  constructor({
    vetApiUrl, vetApiSleepTime, vetApiTimeout,
  }) {
    super({
      baseUrl: vetApiUrl,
      sleepTime: Number(vetApiSleepTime),
      maxAttempt: 5,
      timeout: Number(vetApiTimeout),
    });

    this.web3 = thorify(new Web3(), vetApiUrl);
    this.WEI_TO_VET = '1e18';
    this.WEI_TO_GAS = '1e15';
    this.clauseGas = 16000;
    this.txGas = 5000;
  }


  async getAccount(address, attempt =0) {
    try {
      if (!address) throw Error('`address` is missing');
      return this.get(`accounts/${address}`);
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getAccount(address ,attempt+1);
    } 
  }


  async getBalance(address, attempt=0) {
    try {
      const account = await this.getAccount(address);
      return new Decimal(account.balance).toFixed();
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getBalance(address ,attempt+1);
    }
  }


  // Energy is VTHO token
  async getEnergy(address, attempt=0) {
    try {
      const account = await this.getAccount(address);
      return new Decimal(account.energy).toFixed();
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getEnergy(address ,attempt+1);
    }
  }


  async sendSignedTransaction(raw, attempt =0) {
    try {
      if (!raw) throw Error('`raw` is missing');
      const { id } = await this.post('transactions', { raw });
      return id;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.sendSignedTransaction(raw ,attempt+1);
    }
    
  }


  async getBlock(revision, attempt=0) {
    try {
      let blockNumber = revision;
      if (revision === undefined || revision === null || !_.isNumber(revision)) {
        blockNumber = 'best';
      }
      return this.get(`blocks/${blockNumber}`);
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getBlock(revision ,attempt+1);
    }
  }


  async getLatestBlockHeight(attempt=0) {
    try {
      const { number } = await this.get('blocks/best');
      return number;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getLatestBlockHeight(attempt+1);
    }
  }

  async getLatestBlockHash(attempt=0) {
    try {
      const { id } = await this.get('blocks/best');
      return id;
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getLatestBlockHash(attempt+1);
    }
  }


  async getTransaction(txHash) {
    if (!txHash) throw Error('`txHash` is missing');

    return this.get(`transactions/${txHash}`);
  }

  async decodeRawTransaction(rawTransaction, attempt =0) {
    try {
      return this.web3.utils.sha3(rawTransaction);
    }
    catch(ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.decodeRawTransaction(rawTransaction,attempt+1);
    }
  }
}

module.exports = VetApi;
