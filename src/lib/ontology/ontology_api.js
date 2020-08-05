const Api = require('../api');

class OntologyApi extends Api {
  constructor({ ontologyApiUrl }) {
    super({ baseUrl: ontologyApiUrl, sleepTime: 5, maxAttempt: 1 });
    this.handleError = this.constructor.handleError;
  }

  async getLatestBlockHeight() {
    const json = await this.get('/api/v1/block/height');
    this.handleError(json);
    return json.Result;
  }

  async getBlock(height) {
    const json = await this.get(`/api/v1/block/details/height/${height}`);
    this.handleError(json);
    return json.Result;
  }

  async getTxsByHeight(height) {
    const json = await this.get(`/api/v1/smartcode/event/transactions/${height}`);
    this.handleError(json);

    return json.Result || []; // json.Result == "" if block has zero transactions
  }

  // return ONT & ONG balance
  async getBalance(hash) {
    const json = await this.get(`/api/v1/balance/${hash}`);
    this.handleError(json);
    return json.Result;
  }

  async getAccount(hash) {
    return hash;
  }

  // return transaction hash
  async broadcast(hexData) {
    const json = await this.post('/api/v1/transaction', {
      Data: hexData,
    });
    console.log('json:',json)
    this.handleError(json);
    return json.Result;
  }

  // Success responses will have Error = 0
  // whereas error responses will have Error != 0
  static handleError(jsonResponse) {
    if (jsonResponse.Error !== 0) {
      throw Error(`${jsonResponse.Action} - ${jsonResponse.Desc}`);
    }
  }
}

module.exports = OntologyApi;
