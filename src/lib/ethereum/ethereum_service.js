const Promise = require("bluebird");
const _ = require("lodash");
const snakeCaseKeys = require("snakecase-keys");
const debug = require("debug")("wallet:ethereum_service");
const utils = require("../../utils");
const constants = require("./ethereum_constants");
const ethApi = require("./ethereum_api");
const Service = require("../service");
const Web3 = require("web3");
const ETH_NODE_URL = process.env.ETHEREUM_NODE_URL;
const web3 = new Web3(new Web3.providers.WebsocketProvider(ETH_NODE_URL));
const Decimal = require("decimal.js");

class EthereumService extends Service {
  constructor({
    db,
    block,
    token,
    wallet,
    address,
    funding,
    withdrawal,
    ethereumApi: api,
    ethereumInterpreter: interpreter,
    ethereumNodeUrl,
    ethereumGasPrice,
    ethereumGasLimit,
    signService
  }) {
    const error = {
      INVALID_XPUBS: "Missing xpubs or there are more than 1 xpubs"
    };
    super({
      db,
      api: new ethApi(web3, ethereumNodeUrl),
      block,
      token,
      wallet,
      address,
      funding,
      withdrawal,
      name: constants.NAME,
      error,
      baseFee: constants.BASE_FEE,
      currency: constants.CURRENCY,
      feeCurrency: constants.FEE_CURRENCY,
      interpreter,
      signService
    });
    this.nodeUrl = ethereumNodeUrl;
    this.web3 = web3;
    this.gasPrice = Number(ethereumGasPrice);
    this.gasLimit = Number(ethereumGasLimit);
  }

  async validateWallet(req) {
    const { xpubs } = req;
    if (!xpubs.length && xpubs.length > 1)
      throw Error(this.error.INVALID_XPUBS);
    const wallet = await this.wallets.findByXpubs(this.name, xpubs[0]);

    if (wallet) throw Error(this.error.ALREADY_HAS_WALLET);
  }
  /* eslint-disable class-methods-use-this */
  async ping() {
    const time = String(new Date().getTime());
    return { time };
  }
  /* eslint-disable class-methods-use-this */
  async getBalance() {
    throw Error("Not implement");
  }

  // async generateAddress({ wallet, path }, trx) {
  //   console.log("*---- Service.generateAddress ----*");
  //   const result = await this.signService.getAddressHashs(
  //     JSON.stringify({
  //       currency: this.currency,
  //       path
  //     })
  //   );
  //   const address = result.output.hash;
  //   const memo = "";
  //   await this.addresses.create(
  //     {
  //       path,
  //       memo,
  //       address,
  //       service: this.name,
  //       walletId: wallet.id,
  //       type:
  //         path === this.addresses.path.SETTLEMENT
  //           ? this.addresses.type.SETTLEMENT
  //           : path === this.addresses.path.COLDWALLET
  //           ? this.addresses.type.COLDWALLET
  //           : this.addresses.type.USER
  //     },
  //     trx
  //   );
  //   return { address, memo };
  // }

  async getMeta(wallet, transactions, isColdWallet = true) {
    let address = "";
    if (!isColdWallet) {
      address = wallet.settlementAddress;
    } else {
      address = wallet.coldSettlementAddress;
    }
    console.log("transactions", transactions);
    const { gasPrice, gasLimit } = this;
    const nonce = await this.api.getNonce(address);

    const nonces = await Promise.map(
      transactions,
      async (transaction, index) => ({
        // ...transaction,
        id: transaction.id,
        address: transaction.address,
        amount: transaction.amount / 1000000000,
        nonce: nonce + index,
        gasPrice,
        gasLimit
      })
    );

    return nonces;
  }
  /* eslint-enable class-methods-use-this */
  async validateAddress(req) {
    const { hash } = req;
    try {
      const valid = this.web3.utils.isAddress(hash);
      return { valid };
    } catch (err) {
      return { valid: false };
    }
  }

  async bundleMoveFund(req) {
    const { walletId, currency } = req;
    const wallet = await this.wallets.find(walletId);
    if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);

    const unspentMoveFunds = await this.fundings.findAllUnspentMoveFund(
      wallet,
      currency
    );
    const transactions = await Promise.map(unspentMoveFunds, async funding => {
      const fromAddress = await this.interpreter.derive(
        wallet,
        funding.addressPath
      );
      const { address } = fromAddress;
      const nonce = await this.web3.eth.getTransactionCount(address);
      return {
        id: funding.id,
        fromPath: funding.addressPath,
        toPath: this.addresses.path.SETTLEMENT,
        grossAmount: new Decimal(
          funding.amount - Math.round(this.gasPrice * this.gasLimit)
        )
          .div(1000000000)
          .toFixed(),
        nonce,
        gasPrice: this.gasPrice,
        gasLimit: this.gasLimit,
        currency
      };
    });

    const payload = {
      type: this.bundleType.MOVE_FUND,
      transactions,
      meta: await this.interpreter.getMeta(wallet)
    };

    const option = { deep: true };
    return { payload: JSON.stringify(snakeCaseKeys(payload, option)) };
  }

  async decodeRawTransaction(req) {
    const { raw } = req;
    try {
      const txDecoded = await this.api.decodeRawTransaction(raw);
      return { transaction_hash: txDecoded };
    } catch (err) {
      return { transaction_hash: null };
    }
  }

  // Get balance of settlement address (admin wallet)
  async getTotalBalance(currency, walletId, isColdWallet = true) {
    let totalBalance = "";
    isColdWallet = isColdWallet === "true";
    try {
      const wallet = await this.wallets.find(walletId);
      let address = "";
      if (!isColdWallet) {
        address = wallet.settlementAddress;
      } else {
        address = wallet.coldSettlementAddress;
      }
      const balance = await this.api.getBalance(address);
      totalBalance = this.web3.utils.fromWei(balance, "gwei");
    } catch (err) {
      console.log("ETH.getTotalBalance.err:", err);
      totalBalance = "0";
    }
    console.log("ETH.totalBalance:", totalBalance);
    return { currency, totalBalance };
  }
  //// ETH NEED DEPLAY WHEN BROADCAST BECOZ NONCE OF ADDRESS (0,5s)
  async broadcast(req) {
    console.log("Service.broadcast");
    // Read the payload
    const { payload } = req;
    if (!payload) throw Error(this.error.MISSING_PAYLOAD);

    // Some blockchain requires sorting before broadcasting
    console.log("payload", payload);
    const { transactionsHash: txsHash } = JSON.parse(payload);
    // const rawTxEntries = Object.entries(txsHash);
    // const sortedTxEntries = (
    //   this.interpreter.sortTxEntries &&
    //   await this.interpreter.sortTxEntries(rawTxEntries)
    // ) || rawTxEntries.slice();

    // Broadcast one by one in order of sortedTxEntries
    const successTxsHash = [];
    await Promise.each(txsHash, async txHash => {
      const { hash, externals } = txHash;
      await Promise.delay(300);
      const transactionHash = await this.broadcastAndCreateWithdrawal(
        externals,
        hash
      );
      if (transactionHash) {
        externals.forEach(external => {
          successTxsHash.push({
            externalId: external.id,
            transactionHash,
            outputIndex: external.index || 0
          });
        });
      }
    });
    // await Promise.each(externalIds, async (externalId) => {
    //   const hash = txsHash[externalId] || prevHash;
    //   const broadcasted = (prevHash && txsHash[externalId] == null);
    //   prevHash = hash;
    //   const transactionHash =
    //     await this.broadcastAndCreateWithdrawal(externalId, hash, broadcasted);
    //   if (transactionHash) successTxsHash[externalId] = transactionHash;
    // });

    return { payload: JSON.stringify(successTxsHash) };
  }
}

module.exports = EthereumService;
