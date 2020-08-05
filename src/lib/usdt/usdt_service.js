// const Promise = require('bluebird');
// const _ = require('lodash');
const Decimal = require('decimal.js');
const bitcore = require('bitcore-lib');
const Promise = require('bluebird');
const constants = require('./usdt_constants');
const Service = require('../service');
const snakeCaseKeys = require('snakecase-keys');
const fetch = require('node-fetch');
const { Address } = bitcore;
const USDT_TO_SATOSHI = 100000000;
const DUST_VALUE = 546;

class UsdtService extends Service {
  constructor({
    db,
    block,
    token,
    wallet,
    address,
    funding,
    withdrawal,
    usdtRpc: api,
    usdtInterpreter: interpreter
  }) {
    const error = {
      INVALID_XPUBS: "Missing xpubs or there are more than 1 xpubs",
      INVALID_CURRENCY: 'Currency is not valid',
      NOT_ENOUGH_BALANCE : 'Currenct is not enough for withdraw'
    };
    super({
      db,
      api,
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
      interpreter ,
    });
    this.fetchUnspentUrl = constants.FETCH_UNSPENT_URL;
  }

  async fetchUnspents(address) {
    try {
      const resp = await fetch(
        `${this.fetchUnspentUrl}/unspent?active=${address}`
      );
      const body = await resp.json();
      const { unspent_outputs } = body;
      return unspent_outputs;
    } catch (error) {
      return [];
    }
  }

  async validateWallet(req) {
    const { xpubs } = req;

    if (!xpubs.length && xpubs.length > 1)
      throw Error(this.error.INVALID_XPUBS);
    const wallet = await this.wallets.findByXpubs(this.name, xpubs[0]);

    if (wallet) throw Error(this.error.ALREADY_HAS_WALLET);
  }

  capTransaction(availableBalances, transactions) {
    const balances = { ...availableBalances };

    return transactions.filter(({ currency, amount }) => {
      const { feeCurrency, baseFee } = this;

      //if (balances[feeCurrency].amount.lt(baseFee)) return false;
      //balances[feeCurrency].amount = balances[feeCurrency].amount.sub(baseFee);

      if (balances[currency].amount.lt(amount)) return false;
      balances[currency].amount = balances[currency].amount.sub(amount);

      return true;
    });
  }

  async bundleMoveFund(req) {
    const { walletId, currency } = req;
    const wallet = await this.wallets.find(walletId);
    const SETTLEMENT = await this.addresses.findSettlementFromService(this.name);
    let settlementAddress = process.env.USDT_SETTLEMENT_ADDRESS 
      || SETTLEMENT.address;

    if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);

    if (typeof settlementAddress === "undefined") 
      throw Error("Settlement address is not declared");
    
    if (wallet.service !== currency || currency !== this.currency) {
      throw Error(this.error.INVALID_CURRENCY);
    }

    const unspentMoveFunds = await this.fundings.findAllUnspentMoveFund(wallet, currency);
    const transactions = [];
    const arrMeta = [];
        
    await Promise.each(unspentMoveFunds, async (funding) => {
      try {
        const fromAddress = await this.interpreter.derive(wallet, funding.addressPath);
        const { address } = fromAddress;
        let currentUnspents = await this.fetchUnspents(address);
        let settlementUnspents = await this.fetchUnspents(settlementAddress);
        const maximumFee = 5000 || process.env.USDT_MAXIMUM_FEE;
        const fundValue = DUST_VALUE;
        //const totalUnspent = currentUnspents.reduce((summ, { satoshis }) => summ + satoshis, 0);
        let totalUnspent = 0;

        currentUnspents = currentUnspents.map(inp => {
          totalUnspent += inp.value;
          return {
            ...inp,
            hdPath: funding.addressPath
          }
        });

        settlementUnspents = settlementUnspents.map(inp => {
          totalUnspent += inp.value;
          return  {
            ...inp,
            hdPath: SETTLEMENT.path
          }
        });

        const unspentsArr = currentUnspents.concat(settlementUnspents);

        console.log("total unspent", totalUnspent);
        console.log("current unspennt", currentUnspents);
        console.log("settlement unspennt", settlementUnspents);
        console.log("unspennt arr", unspentsArr);

        if (totalUnspent < maximumFee + fundValue) {
          throw new Error(`Total less than fee: ${totalUnspent} < ${maximumFee} + ${fundValue}`);
        }

        arrMeta.push(funding.id);

        transactions.push({
          unspents: unspentsArr,
          id: funding.id,
          fromPath: funding.addressPath,
          toPath: this.addresses.path.SETTLEMENT,
          amount: new Decimal(funding.amount).toFixed(),
          currency,
        });
      } 
      catch (error) {
        this.debug(error);
      }
    });

    const payload = {
      type: this.bundleType.MOVE_FUND,
      transactions,
      //meta: await this.interpreter.getMeta(wallet)
      meta: arrMeta
    };

    const option = { deep: false };
    const parseToJson = JSON.stringify(snakeCaseKeys(payload, option));
    console.log("parse to json", parseToJson);

    return { payload: parseToJson };
  }


  async getMeta(wallet, transactions) {
    const SETTLEMENT = await this.addresses.findSettlementFromService(this.name);
    const { settlementAddress: address } = wallet;
    let unspents = await this.fetchUnspents(address);
    const fundValue = DUST_VALUE * transactions.length;
    const maximumFee = 10000 || process.env.USDT_MAXIMUM_FEE;

    const totalUnspent = unspents.reduce(
      (summ, { value: satoshis }) => summ + satoshis, 0
    );

    unspents = unspents.map(inp => {
      return {
        ...inp,
        hdPath: SETTLEMENT.path
      }
    });

    if (totalUnspent < maximumFee + fundValue) {
      throw new Error(
        `Total less than fee: ${totalUnspent} < ${maximumFee} + ${fundValue}`
      );
    }

    return {
      inputs: unspents,
      outputs: transactions
    };
  }

  async ping() {
    const time = String(new Date().getTime());
    return { time };
  }
  
  async getBalance() {
    throw Error("Not implement");
  }
  
  async computeTotalBalances(wallet) {
    const balances = {};
    const { currency } = this;
    const amount = await this.fundings
      .sumUnspentAmountByWalletIdAndCurrency(wallet.id, currency)
      .div(USDT_TO_SATOSHI);
    balances[currency] = { amount };
    return balances;
  }

  async validateAddress(req) {
    const { hash } = req;
    try {
      const address = Address.fromString(hash, "livenet");
      if (address.toString() !== hash) {
        throw Error("Address not match");
      }
      return { valid: true };
    } catch (err) {
      return { valid: false };
    }
  }

  async decodeRawTransaction(req) {
    const { raw } = req;
    try {
      const txDecoded = await this.api.decodeRawTx(raw);
      return { transaction_hash: txDecoded.txid };
    } catch (err) {
      return { transaction_hash: null };
    }
  }
}

module.exports = UsdtService;