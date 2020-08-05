const fetch = require("node-fetch");
const Promise = require("bluebird");
const Decimal = require("decimal.js");
// const debug = require('debug')('wallet:tron_api');
const url = process.env.SERVICE_NODE_URL;
const sleepTime = process.env.SERVICE_SLEEP_TIME;
const signToken = process.env.SERVICE_TOKEN;

const crypto = require("crypto");

class SignService {
  constructor() {
    this.base = url;
    this.sleepTime = Number(sleepTime);
    this.MAX_ATTEMPT = 20;
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

  async post(path, body, signature) {
    const method = "POST";
    const headers = {
      "Content-Type": "application/json",
      signature: signature
    };
    const options = { method, body, headers };
    const raw = await fetch(this.base + path, options);
    return raw.json();
  }

  async getSignedHashs(body) {
    const hmac = crypto.createHmac("sha256", signToken);
    hmac.update(body);
    const hash = hmac.digest("hex");
    console.log("Method 2: ", hash);
    const encypHash = hash;
    const broadcast = await this.post("/sign", body, encypHash);
    return broadcast;
  }

  async getAddressHashs(body) {
    const hmac = crypto.createHmac("sha256", signToken);
    hmac.update(body);
    const hash = hmac.digest("hex");
    console.log("Method 2: ", hash);
    const encypHash = hash;
    const broadcast = await this.post("/get_address", body, encypHash);
    return broadcast;
  }

  async validateAddress(body) {
    const hmac = crypto.createHmac("sha256", signToken);
    hmac.update(body);
    const hash = hmac.digest("hex");
    console.log("Method 2: ", hash);
    const encypHash = hash;
    const broadcast = await this.post("/validate_address", body, encypHash);
    return broadcast;
  }
}

module.exports = SignService;
