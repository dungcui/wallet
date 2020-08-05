const fetch = require('node-fetch');
const debug = require('debug')('wallet:api');
const { resolve: urlResolve } = require('url');
const Promise = require('bluebird');

class Api {
  constructor({ baseUrl, sleepTime, maxAttempt, timeout }) {
    this.base = baseUrl;
    this.sleepTime = Number(sleepTime);
    this.timeout = timeout; // in ms
 

    // Set to 0 to disable attempt
    this.MAX_ATTEMPT = maxAttempt;
  }

  async get(path, attempt = 0) {
    try {
      const url = urlResolve(this.base, path);
      const raw = await fetch(url, { timeout: this.timeout });

      await this.constructor.validateRequest(raw);

      debug(`Get ${path} success`);
      return raw.json();
    } catch (err) {
      // No retry if MAX_ATTEMPT is 0
      if (this.MAX_ATTEMPT === 0) throw err;

      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries on path ${path}, exit.`);
      }

      debug(`GET ${path} failed, retry...`);
      await Promise.delay(1000 * this.sleepTime);
      return this.get(path, attempt + 1);
    }
  }

  async post(path, body) {
    try {
      if (this.base == 'https://dex.binance.org/')
      var options = {
        method: 'POST',
        body: body,
        headers: { 'Content-Type': 'text/plain' },
        timeout: this.timeout,
      }
    else 
      var options = {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
        timeout: this.timeout,
      }

    const url = urlResolve(this.base, path);
    const raw = await fetch(url, options);
    await this.constructor.validateRequest(raw);
    return raw.json();
    } catch (err) {
      console.log("exception apu",err);
      throw Error("time out");
    }

  }

  async postWithSignature(path, body,signature) {
  
    var options = {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' ,'signature': signature},
      timeout: this.timeout,
    }

    const url = urlResolve(this.base, path);
    const raw = await fetch(url, options);
    await this.constructor.validateRequest(raw);
    return raw.json();
  }


  
  async sendRequest(path, body)  {
    console.log('API.sendRequest');
    const options = {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      timeout: this.timeout,
    };
    const url = urlResolve(this.base, path);
    await fetch(url, options);
  }

  static async validateRequest(raw) {
    if (raw.status > 202) {
      const responseMsg = await raw.text();

      debug(`GET response with status ${raw.status} - ${responseMsg} `);
      throw Error(`${raw.status} - ${responseMsg}`);
    }
  }
}

module.exports = Api;
