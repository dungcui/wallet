const Promise = require("bluebird");
const _ = require("lodash");
const constants = require("./erc20_constants");
console.log("constants ", constants);
const erc20Api = require("./erc20_rpc");
const Web3 = require("web3");
const ERC20_NODE_URL = process.env.ERC20_NODE_URL;
const web3 = new Web3(new Web3.providers.WebsocketProvider(ERC20_NODE_URL));
const EthereumTx = require("ethereumjs-tx");
const fetch = require("node-fetch");

const Transporter = require("../transporter.js");
//  const erc20Ap/i = require('./erc20_rpc');

const Decimal = require("decimal.js");
// const erc20Contract= require('./erc20_contract')
class Erc20Transporter extends Transporter {
  constructor({
    db,
    block,
    token,
    wallet,
    address,
    funding,
    withdrawal,
    signService,
    estimateGas,
    erc20Rpc: api,
    erc20Interpreter: interpreter,
    erc20NodeUrl,
    erc20GasPrice,
    erc20GasLimit,
    erc20Contract,
    erc20TransporterSleepTime: sleepTime,
    erc20EstimateGasUrl: estimateGasUrl,
    erc20PrivatekeyFeeAddress,
    erc20FeeAddress
  }) {
    const error = {
      INVALID_XPUBS: "Missing xpubs or there are more than 1 xpubs"
    };
    super({
      db,
      api: new erc20Api(web3),
      block,
      token,
      wallet,
      address,
      funding,
      withdrawal,
      signService,
      estimateGas,
      name: constants.NAME,
      error,
      baseFee: constants.BASE_FEE,
      currency: constants.CURRENCY,
      feeCurrency: constants.FEE_CURRENCY,
      interpreter,
      sleepTime,
      estimateGasUrl
    });
    // this.tokens = token;
    this.erc20PrivatekeyFeeAddress = erc20PrivatekeyFeeAddress;
    this.erc20FeeAddress = erc20FeeAddress;
    this.nodeUrl = erc20NodeUrl;
    this.web3 = web3;
    this.gasPrice = Number(erc20GasPrice);
    this.gasLimit = Number(erc20GasLimit);
    this.smartContract = erc20Contract;
  }

  async distributeGasAndMoveFund() {
    console.log("ERC2.0_distributeGasAndMoveFund");
    const gasPrice = await this.getEsimateGas();
    const gasLimit = 21000;
    const gasLimitToken = 80000;
    await this.tokens.preload([this.name]);
    const tokens = await this.tokens.getAllByService(this.name);
    const wallet = await this.wallets.findAllByService(this.name);
    const addresses = await this.addresses.findAllByService(this.name);
    await Promise.each(tokens, async token => {
      await Promise.each(addresses, async address => {
        // check balance token each address except settement
        if (address.address != wallet[0].settlementAddress) {
          let balance = await this.getGrossBalance(token, address.address);
          balance = new Decimal(balance * 1000).floor() / 1000;
          console.log(" balance ", balance.toFixed());
          if (balance > 10) {
            console.log(
              " start  distributeGasAndMoveFund from address ",
              address.address,
              " token ",
              token.currency
            );
            const grossAmount = new Decimal(gasPrice * gasLimitToken);
            const balanceETH = await this.getEthBalance(address.address);

            /// caculation eth for distribuitor for move fund by gwei
            const amount = new Decimal(grossAmount - balanceETH);
            if (amount > 0) {
              await this.distributorGas(
                address.address,
                amount,
                gasPrice,
                gasLimit
              );
            }
            await this.autoMoveFunds(
              address,
              wallet[0].settlementAddress,
              token,
              balance,
              gasPrice,
              gasLimitToken
            );
          }
        }
      });
    });

    await Promise.delay(1000 * 60 * 60 * this.sleepTime);
  }

  async distributorGas(toAddress, amount, gasPrice, gasLimit) {
    console.log("ERC2.0_monitor.autoMoveFunds");
    console.log("amout for distribuitor ", amount.toFixed());
    const privateKey = this.erc20PrivatekeyFeeAddress;
    const nonce = await this.web3.eth.getTransactionCount(this.erc20FeeAddress);
    const hash = await this.signTx(
      privateKey,
      toAddress,
      nonce,
      amount,
      gasPrice,
      gasLimit
    );
    console.log("hash:", hash);
    try {
      const transactions = await this.api.broadcast(hash);
      console.log("transactions", transactions);
      const transactions_hash = transactions.transactions_hash;
      console.log("transactions_hash:", transactions_hash);
      return transactions_hash;
    } catch (err) {
      console.log("err", err);
    }
  }

  async signTx(privateKey, toAddress, nonce, value, gas_price, gas_limit) {
    // console.log("ETH_service.signTx ", value);
    let web3 = this.web3;
    const pk = Buffer.from(privateKey, "hex");
    const gasPrice = await web3.utils.toBN(
      web3.utils.toWei(web3.utils.toBN(gas_price), "gwei")
    );
    const gasLimit = await web3.utils.toBN(web3.utils.toBN(gas_limit));
    const amount = await web3.utils.toBN(web3.utils.toWei(`${value}`, "gwei")); // default: ETH
    const txOptions = {
      nonce,
      gasLimit,
      gasPrice,
      to: toAddress,
      value: amount
    };
    const tx = new EthereumTx(txOptions);
    tx.sign(pk);
    return tx.serialize().toString("hex");
  }

  async autoMoveFunds(
    address,
    settlementAddress,
    token,
    grossAmout,
    gasPrice,
    gasLimit
  ) {
    const nonce = await this.web3.eth.getTransactionCount(address.address);
    const transactions = [
      {
        id: "M1",
        fromAddress: address.address,
        fromPath: address.path,
        toAddress: settlementAddress,
        grossAmount: grossAmout,
        nonce,
        gas_price: gasPrice,
        gas_limit: gasLimit,
        currency: token.currency,
        contract: token.address,
        decimal: token.decimals
      }
    ];
    const payload = {
      type: this.bundleType.MOVE_FUND,
      transactions,
      meta: {}
    };
    try {
      const body = { currency: this.currency, transactions: payload };
      console.log("body", JSON.stringify(body));
      const signedHash = await this.signService.getSignedHashs(
        JSON.stringify(body)
      );
      console.log("signedHash", signedHash);
      // const bodyResult = JSON.parse(signedHash);
      if (signedHash.status === "Success") {
        const result = await Promise.map(
          signedHash.output.transactionsHash,
          async transaction_hash => {
            console.log("transaction_hash", transaction_hash);
            return await this.api.broadcast(transaction_hash.hash);
          }
        );
        return result;
      }
    } catch (err) {
      console.log("err", err);
    }
  }

  async getEsimateGas() {
    const currentTime = Date.now();
    const estimateGas = await this.estimateGas.findByService(this.name);
    if (
      !estimateGas ||
      (estimateGas &&
        parseInt(currentTime - estimateGas.updatedAt) / (1000 * 60) > 1)
    ) {
      try {
        const method = "GET";
        const headers = {
          "Content-Type": "application/json"
        };
        const options = { method, headers };
        const raw = await fetch(this.estimateGasUrl, options);
        const result = await raw.json();
        const gasPrice = new Decimal(result.fast / 10).round().toFixed();
        await this.estimateGas.update(this.name, gasPrice);
        return gasPrice;
      } catch (ex) {
        return estimateGas.gasPrice;
      }
    } else {
      return estimateGas.gasPrice;
    }
  }

  async getGrossBalance(token, address) {
    try {
      const balance = await this.api.getBalance(token.address, address);
      return new Decimal(balance).div(Math.pow(10, token.decimals));
    } catch (ex) {
      return 0;
    }
  }

  async getEthBalance(address) {
    try {
      const balance = await this.api.getBalanceEth(address);
      return this.web3.utils.fromWei(balance, "gwei");
    } catch (ex) {
      console.log("ex", ex);
      return 0;
    }
  }

  async getIssuer(currency) {
    const tokens = this.tokens
      .getAllByService(this.name)
      .map(token => token.currency);

    return tokens.indexOf(currency) > -1
      ? (await this.tokens.find(this.name, currency)).address
      : this.NATIVE_ISSUER;
  }
}

module.exports = Erc20Transporter;
