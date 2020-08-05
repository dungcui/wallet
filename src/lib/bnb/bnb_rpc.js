const fetch = require("node-fetch");
const Decimal = require("decimal.js");
const debug = require("debug")("wallet:bnb_rpc");
const Api = require("../api");
const Promise = require("bluebird");

class BnbRpc extends Api {
  constructor({ bnbNodeUrl, bnbSleepTime, bnbTimeout }) {
    super({
      baseUrl: bnbNodeUrl,
      sleepTime: Number(bnbSleepTime),
      maxAttempt: 20,
      timeout: bnbTimeout
    });
    this.bnbNodeUrl = bnbNodeUrl;
  }

  async getBlock(num) {
    return this.get(`/tx_search?query=\"tx.height=${num}\"&prove=true`);
  }

  async getLatestBlockHeight() {
    const info = await this.get("/api/v1/node-info");
    return info.sync_info.latest_block_height;
  }

  async getSequence(address) {
    return this.get(`/api/v1/account/${address}/sequence`);
  }

  async getInfo() {
    const info = await this.get("/api/v1/node-info");
    return info;
  }

  /* Account Infomation
        account_number  : number
        address         : string
        balances        : array [{free,frozen,locked,symbol}]
        public_key      : buffer
        sequence        : number
  */

  async getAccountInfo(address) {
    const accountInfo = await this.get(`/api/v1/account/${address}`);
    return accountInfo;
  }

  async findTransactionsByAddress(address) {
    const txs = await this.get(
      `/api/v1/transactions?address=${address}&txType=TRANSFER&txAsset=BNB&limit=30`
    );
    return txs.tx;
  }

  async accountExist(address) {
    try {
      const accountInfo = await this.get(`/api/v1/account/${address}`);
      if (accountInfo) return true;
      else return false;
    } catch (err) {
      return false;
    }
  }

  async getBalance(account) {
    const Balance = await this.getCurrencyBalance(account);
    console.log("Balance:", Balance);
    if (Balance) return Balance;
    else return 0;
  }

  async getCurrencyBalance(address) {
    const accountInfo = await this.get(`/api/v1/account/${address}`);
    const balances = accountInfo.balances;
    var balanceBNB = 0;
    const balance = await Promise.map(balances, async balance => {
      if (balance.symbol == "BNB") balanceBNB = balance.free;
    });
    return balanceBNB;
  }

  async broadcast(rawTransaction) {
    const broadcast = await this.post(
      "/api/v1/broadcast?sync=true",
      rawTransaction
    );
    return broadcast;
  }
}

module.exports = BnbRpc;
