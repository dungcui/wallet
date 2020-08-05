const Promise = require("bluebird");
const _ = require("lodash");
const snakeCaseKeys = require("snakecase-keys");
const debug = require("debug")("wallet:erc20_service");
const utils = require("./erc20_utils");
const constants = require("./erc20_constants");
const erc20Api = require("./erc20_rpc");
const Web3 = require("web3");
const ERC20_NODE_URL = process.env.ERC20_NODE_URL;
const web3 = new Web3(new Web3.providers.WebsocketProvider(ERC20_NODE_URL));

const Service = require("../service");
//  const erc20Ap/i = require('./erc20_rpc');

const Decimal = require("decimal.js");
// const erc20Contract= require('./erc20_contract')
class Erc20Service extends Service {
  constructor({
    db,
    block,
    token,
    wallet,
    address,
    funding,
    withdrawal,
    erc20Rpc: api,
    erc20Interpreter: interpreter,
    signService,
    erc20NodeUrl,
    erc20GasPrice,
    erc20GasLimit,
    erc20Contract
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
      name: constants.NAME,
      error,
      baseFee: constants.BASE_FEE,
      currency: constants.CURRENCY,
      feeCurrency: constants.FEE_CURRENCY,
      interpreter,
      signService
    });
    // this.tokens = token;
    this.nodeUrl = erc20NodeUrl;
    this.web3 = web3;
    this.gasPrice = Number(erc20GasPrice);
    this.gasLimit = Number(erc20GasLimit);
    this.smartContract = erc20Contract;
  }

  async validateWallet(req) {
    const { xpubs } = req;
    if (!xpubs.length && xpubs.length > 1)
      throw Error(this.error.INVALID_XPUBS);
    const wallet = await this.wallets.findByXpubs(this.name, xpubs[0]);

    if (wallet) throw Error(this.error.ALREADY_HAS_WALLET);
  }
  /* eslint-disabile class-methods-use-this */
  async ping() {
    const time = String(new Date().getTime());
    return { time };
  }
  /* eslint-disable class-methods-use-this */
  async getBalance() {
    throw Error("Not implement");
  }

  async getMeta(wallet, transactions, isColdWallet = true) {
    let address = "";
    if (!isColdWallet) {
      address = wallet.settlementAddress;
    } else {
      address = wallet.coldSettlementAddress;
    } // console.log("transactions",transactions);
    const token = await this.tokens.find(this.name, transactions[0].currency);
    const nonce = await this.api.getNonce(address);

    const { gasPrice, gasLimit } = this;
    const nonces = await Promise.map(
      transactions,
      async (transaction, index) => ({
        ...transaction,
        nonce: nonce + index,
        gas_price: gasPrice,
        gas_limit: gasLimit,
        contract: token.address,
        decimal: token.decimals,
        token: token.currency
      })
    );
    return nonces;
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
  capTransaction(availableBalances, transactions) {
    const balances = { ...availableBalances };
    console.log("balances", balances);
    console.log("transactions", transactions);
    return transactions.filter(({ currency, amount }) => {
      console.log("currency", currency);
      const { feeCurrency, baseFee } = this;

      console.log("currency", currency);
      console.log("feeCurrency", balances[feeCurrency].amount.toFixed());
      console.log("balances", balances[currency].amount.toFixed());

      if (balances[feeCurrency].amount.lt(baseFee)) return false;
      balances[feeCurrency].amount = balances[feeCurrency].amount.sub(baseFee);

      if (balances[currency].amount.lt(amount)) return false;
      balances[currency].amount = balances[currency].amount.sub(amount);

      return true;
    });
  }

  async computeAvailableWithdrawals(wallet, isColdWallet = true) {
    const balances = {};
    const tokens = this.tokens.getAllByService(this.name);
    const currencies = [...tokens.map(token => token.currency), this.currency];
    const { address: settlementAddress } = await this.addresses.findByPath(
      wallet.id,
      isColdWallet
        ? this.addresses.path.COLDWALLET
        : this.addresses.path.SETTLEMENT
    );
    currencies.push("ETHEREUM");

    await Promise.each(currencies, async currency => {
      const amount = await this.fundings.sumUnspentAmountByAddressAndCurrency(
        settlementAddress,
        currency
      );
      const issuer = await this.getIssuer(currency);
      balances[currency] = { amount, issuer };
    });
    return balances;
  }

  async bundleMoveFund(req) {
    const { walletId, currency } = req;
    const wallet = await this.wallets.find(walletId);
    if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);

    const unspentMoveFunds = await this.fundings.findAllUnspentMoveFundWithoutCurrencyForERC(
      wallet
    );
    console.log("unspentMoveFunds", unspentMoveFunds);
    const transactions = await Promise.map(unspentMoveFunds, async funding => {
      const fromAddress = await this.interpreter.derive(
        wallet,
        funding.addressPath
      );
      const { address } = fromAddress;
      const nonce = await this.web3.eth.getTransactionCount(address);
      const token = await this.tokens.find(this.name, funding.currency);
      console.log("token", token);
      return {
        id: funding.id,
        fromPath: funding.addressPath,
        toPath: this.addresses.path.SETTLEMENT,
        grossAmount: new Decimal(funding.amount).toFixed(),
        nonce,
        gas_price: this.gasPrice,
        gas_pimit: this.gasLimit,
        currency,
        contract: token.address,
        decimal: token.decimals
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

  async addContractToken(req) {
    const { currency, address, smartContract } = req;

    // Get decimals from Ether node
    const object = utils.getObject(address, "decimals()", []);
    const hex = await this.api.ethCall(object);
    const decimals = new Decimal(hex).toNumber();
    const wallet = await this.wallets.findByService(this.name);

    // If couldn't get decimals from blockchain -> throw error
    if (!decimals) {
      throw new Error(
        `Could not find decimals of the contract address ${address}`
      );
    }

    // Add to db
    await this.db.transaction(async trx => {
      // console.log({address, token ,decimals})
      await this.tokens.createWithEnable(
        {
          service: currency,
          address,
          currency: smartContract,
          enabled: true,
          decimals
        },
        trx
      );
    });
    return { id: wallet.id, token: smartContract, decimals, address: address };
  }

  // Get balance of settlement address (admin wallet)
  async getTotalBalance(currency, walletId, isColdWallet = true) {
    let totalBalance = "";
    isColdWallet = isColdWallet === "true";
    try {
      const token = await this.tokens.find(this.name, currency);
      const contractAddress = token.address;
      const decimal = token.decimals;
      console.log("currency:", currency);
      console.log("contractAddress:", contractAddress);
      console.log("decimal:", decimal);
      const wallet = await this.wallets.find(walletId);
      let address = "";
      if (!isColdWallet) {
        address = wallet.settlementAddress;
      } else {
        address = wallet.coldSettlementAddress;
      }
      console.log("address:", address);
      const balance = await this.api.getBalance(contractAddress, address);
      console.log("balance:", balance);
      totalBalance = new Decimal(balance).div(Math.pow(10, decimal)).toString();
      // totalBalance = this.web3.utils.fromWei(balance, "ether");
    } catch (err) {
      console.log("ERC20.getTotalBalance.err:", err);
      totalBalance = "0";
    }
    console.log("ERC20.totalBalance:", totalBalance);
    return { currency, totalBalance };
  }
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
      console.log("txHash", txHash);
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
  async validateAddress(req) {
    const { hash } = req;
    try {
      const valid = this.web3.utils.isAddress(hash);
      return { valid };
    } catch (err) {
      return { valid: false };
    }
  }

  // async getLastestBlock (currency )
  // {
  //   const block  = await this.api.getLatestBlockHeight();
  //   return {currency ,block};
  // }
}

module.exports = Erc20Service;
