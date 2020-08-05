const debug = require("debug");
const Promise = require("bluebird");
const { formatAddressWithMemo } = require("../utils");
const keyToken = process.env.KEY_TOKEN;
const hashKey = process.env.HASH_KEY;

const crypto = require("crypto");
class Transporter {
  constructor({
    // Global
    db,
    api,
    block,
    token,
    wallet,
    address,
    funding,
    withdrawal,
    limit,
    failedApi,
    signService,
    estimateGas,
    // Local
    name,
    error,
    baseFee,
    currency,
    feeCurrency,
    interpreter,
    sleepTime,
    estimateGasUrl
    // get
    // bchRpc,
  }) {
    // Components
    this.db = db;
    this.api = api;
    this.blocks = block;
    this.tokens = token;
    this.wallets = wallet;
    this.fundings = funding;
    this.addresses = address;
    this.withdrawals = withdrawal;
    this.interpreter = interpreter;
    this.signService = signService;
    this.estimateGas = estimateGas;
    this.limits = limit;
    this.failedApi = failedApi;
    // Configs
    this.name = name;
    this.baseFee = baseFee;
    this.currency = currency;
    this.feeCurrency = feeCurrency;
    this.debug = debug(`wallet:service:${this.name}`);
    this.sleepTime = sleepTime;
    this.estimateGasUrl = estimateGasUrl;
    this.error = {
      ...error,
      EMPTY_PATH: "Path empty.",
      MISSING_ADDRESS: "Missing address.",
      MISSING_PAYLOAD: "Missing payload.",
      WALLET_NOT_FOUND: "Wallet not found.",
      MISSING_WALLET_ID: "Missing wallet Id",
      ALREADY_HAS_WALLET: "Already has wallet.",
      MISSING_TRANSACTIONS: "Missing transactions",
      DUPLICATED_WITHDRAWAL: "Duplicated withdrawal",
      MOVE_FUND_NOT_IMPLEMENTED: "Move fund has not implemented",
      NOT_HAVE_SMART_CONTACT: "Currency not have suport smart contract",
      GET_TOTAL_BALANCE_NOT_IMPLEMENTED:
        "Get total balance has not implemented",
      ERR_501: " Not authorized"
    };

    this.bundleType = {
      MOVE_FUND: "move_fund",
      WITHDRAWAL: "withdrawal"
    };
  }

  async start() {
    this.isRunning = true;
    this.canStop = false;
    await this.run();
    this.canStop = true;
  }

  async stop() {
    this.isRunning = false;
    this.debug("Attempt to stop...");
    if (this.canStop) {
      this.debug("Stopped.");
      return;
    }
    await Promise.delay(1000 * this.sleepTime);
    await this.stop();
  }

  async run() {
    while (this.isRunning) {
      await this.distributeGasAndMoveFund();
    }
  }

  async distributeGasAndMoveFund() {}
  async getIssuer(currency) {
    const tokens = this.tokens
      .getAllByService(this.name)
      .map(token => token.currency);

    return tokens.indexOf(currency) > -1
      ? (await this.tokens.find(this.name, currency)).address
      : this.NATIVE_ISSUER;
  }
}

module.exports = Transporter;
