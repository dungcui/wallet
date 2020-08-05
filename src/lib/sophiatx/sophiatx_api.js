const jayson = require('jayson');
const Promise = require('bluebird');

class SophiatxApi {
  constructor({ SOPHIATX_API_URL }) {
    this.apiUrl = SOPHIATX_API_URL;
    if (!this.apiUrl) {
      throw Error('Please provide SOPHIATX_API_URL');
    }
    this.client = Promise.promisifyAll(jayson.client.https(this.apiUrl));
    this.requestId = 1;
  }

  async broadcast(raw) {
    const transaction = JSON.parse(Buffer.from(raw, 'hex').toString('utf8'));
    return (await this.client.requestAsync('broadcast_transaction', [transaction], this.requestId)).result;
  }

  async getBlock(height) {
    return (await this.client.requestAsync('get_block', [height], this.requestId)).result;
  }

  async accountExist(hash) {
    return (await this.client.requestAsync('account_exist', [hash], this.requestId)).result;
  }

  async createSimpleTransaction(operation) {
    return (await this.client.requestAsync('create_simple_transaction', [operation], this.requestId)).result;
  }

  async getTransactionDigest(transaction) {
    return (await this.client.requestAsync('get_transaction_digest', [transaction], this.requestId)).result;
  }

  async getLatestBlockHeight() {
    return (await this.client.requestAsync('info', [], this.requestId))
      .result
      .head_block_number;
  }

  async findTransactionsByAddress(address, startIndex, distanceFromStartIndex) {
    return (await this.client.requestAsync(
      'get_account_history',
      [address, startIndex, distanceFromStartIndex],
      this.requestId,
    )).result;
  }
}

module.exports = SophiatxApi;
