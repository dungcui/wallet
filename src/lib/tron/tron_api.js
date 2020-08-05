const fetch = require('node-fetch');
const Promise = require('bluebird');
const Decimal = require('decimal.js');
const debug = require('debug')('wallet:tron_api');


class TronApi {
  constructor({ tronApiUrl, tronSleepTime }) {
    this.base = tronApiUrl;

    // Get retry config
    this.sleepTime = Number(tronSleepTime);
    this.MAX_ATTEMPT = 2;

    // 1 TRX = 1,000,000 sun
    this.DECIMALS = 6;
    this.ONE_TRX = new Decimal(1e6);

    // Page for transactions
    // 1 page contains MAX_TRANSACTION_LIMIT transactions
    this.MAX_TRANSACTION_LIMIT = 100;
    this.MAX_PAGES_PER_SECTION = 3;
    this.endPage = 0;
  }

  async get(path, attempt = 0) {
    if (attempt === this.MAX_ATTEMPT) {
      throw Error(`Failed after ${attempt} retries on path ${path}, exit.`);
    }
    try {
      const raw = await fetch(this.base + path);
      if (raw.status !== 200) throw Error();
      return raw.json();
    } catch (err) {
      debug(`GET ${path} failed, retry...`);
      await Promise.delay(1000 * this.sleepTime);
      return this.get(path, attempt + 1);
    }
  }

  async post(path, body) {
    const method = 'POST';
    const headers = { 'Content-Type': 'application/json' };
    const options = { method, body, headers };
    const raw = await fetch(this.base + path, options);
    return raw.json();
  }

  async getTotalTransactions(attempt = 0) {
    try {
      const { total } = await this.get('/api/transaction?sort=block&limit=1&start=0&count=true');
    return total;
    } catch (err) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.getTotalTransactions(attempt+1);    
    }  
  }

  async getTotalPages(limit) {
    const totalTxs = await this.getTotalTransactions();
    return Math.ceil(totalTxs / limit);
  }

  async getTransactionsOfPage(page, limit, attempt = 0) {
    try {
      const start = page * limit;
      const { data } = await this.get(`/api/transaction?sort=block&limit=${limit}&start=${start}`);
      return data;
    } catch (err) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.getTransactionsOfPage(page, limit,attempt+1);    
    }  
  }

  async find(height, left, right) {
    debug(`Search from ${left} to ${right}`);
    if (left >= right) return left;
    const mid = Math.floor((left + right) / 2);
    const txs = await this.getTransactionsOfPage(mid, this.MAX_TRANSACTION_LIMIT);
    return (txs.length && txs[txs.length - 1].block < height)
      ? this.find(height, mid + 1, right)
      : this.find(height, left, mid);
  }

  async findPageByBlockHeight(height) {
    const right = (await this.getTotalPages(this.MAX_TRANSACTION_LIMIT)) - 1;
    const left = this.endPage;
    return this.find(height, left, right);
  }

  async getBlocksHashOfPage(page) {
    const transactions = await this.getTransactionsOfPage(page, this.MAX_TRANSACTION_LIMIT);
    const blocksHash = transactions.reduce((result, tx) => ({
      ...result,
      [tx.block]: true,
    }), {});
    return blocksHash;
  }

  async getBlockHeightsAfter(startBlockHeight) {
    const startPage = await this.findPageByBlockHeight(startBlockHeight);
    const totalPages = await this.getTotalPages(this.MAX_TRANSACTION_LIMIT);
    this.endPage = Math.min(totalPages - 1, startPage + this.MAX_PAGES_PER_SECTION);
    const pagesCount = (this.endPage - startPage) + 1;
    const pages = new Array(pagesCount)
      .fill(null, 0, pagesCount)
      .map((_, index) => startPage + index);
    let result = {};
    await Promise.each(pages, async (page) => {
      const blocksHash = await this.getBlocksHashOfPage(page);
      result = { ...result, ...blocksHash };
    });
    return Object
      .keys(result)
      .map(Number)
      .filter(height => height > startBlockHeight);
  }

  async getBlock(height, attempt = 0) {
    try {
      return this.get(`/api/block/${height}`);
    } catch (err) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.getBlock(height,attempt+1);    
    }
  }

  async getLatestBlock(attempt = 0) {
    try {
      return this.get('/api/block/latest');
    } catch (err) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.getLatestBlock(attempt+1);    
    }
  }

  async getBlockTransactions(height) {
    const getAll = async (page = 0, limit = this.MAX_TRANSACTION_LIMIT) => {
      const start = page * limit;
      const path = `/api/transaction?block=${height}&sort=-timestamp&count=true&start=${start}&limit=${limit}`;
      const { total, data } = await this.get(path);
      if (total <= start + limit) return { total, data };
      const { data: nextData } = await getAll(page + 1, limit);
      return { total, data: [...data, ...nextData] };
    };
    return getAll();
  }

  async getAccount(addressHash, attempt = 0) {
    try {
      return this.get(`/api/account?address=${addressHash}`);
    } catch (err) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.getAccount(addressHash, attempt+1);    
    }
  }

  async validateAddress(addressHash, attempt = 0) {
    try {
      const { status } = await fetch(`${this.base}/api/account?address=${addressHash}`);
      return status === 200;    
    } catch (err) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.validateAddress(addressHash, attempt+1);    
    }
  }

  async broadcast(transaction , attempt = 0) {
    try {
      console.log('*---- TRON_API.broadcast ----*')
      console.log('transaction:',transaction)
      const broadcast = await this.post('/api/broadcast', JSON.stringify({ transaction }));
      console.log('broadcast:',broadcast)
      return broadcast;
    } catch (err) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.broadcast(transaction, attempt+1);    
    }
  }
}

module.exports = TronApi;
