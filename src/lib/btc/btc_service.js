const Promise = require("bluebird");
const _ = require("lodash");
const Decimal = require("decimal.js");
// const debug = require('debug')('wallet:btc_service');
const { Address } = require("bitcore-lib");
const utils = require("../../utils");
const constants = require("./btc_constants");
const Service = require("../service");

const bitcore = require("bitcore-lib");
const Script = bitcore.Script;

const BTC_TO_SATOSHI = 100000000;

class BtcService extends Service {
  constructor({
    db,
    block,
    token,
    wallet,
    address,
    funding,
    withdrawal,
    limit,
    failedApi,
    btcRpc: api,
    signService,
    btcInterpreter: interpreter,
    btcMaximumInput,
    btcMaximumFee,
    btcMaximumFeePerByte,
    btcAverageFeeBlocks
  }) {
    const error = {
      INVALID_XPUBS: "Missing xpubs or there are more than 1 xpubs",
      GET_LIMIT_ERROR: "Get limit currency error"
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
      limit,
      failedApi,
      name: constants.NAME,
      error,
      baseFee: constants.BASE_FEE,
      currency: constants.CURRENCY,
      feeCurrency: constants.FEE_CURRENCY,
      interpreter,
      signService
    });
    this.maximumInput = Number(btcMaximumInput);
    this.maximumFee = Number(btcMaximumFee);
    this.maximumFeePerByte = parseInt(btcMaximumFeePerByte, 10);
    this.averageFeeBlocks = parseInt(btcAverageFeeBlocks, 10);
  }

  async validateWallet(req) {
    const { xpubs } = req;

    if (!xpubs.length && xpubs.length > 1)
      throw Error(this.error.INVALID_XPUBS);
    const wallet = await this.wallets.findByXpubs(this.name, xpubs[0]);
    this.debug("â ", wallet);
    if (wallet) throw Error(this.error.ALREADY_HAS_WALLET);
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

  async addWallet(req) {
    // Validate req
    await this.validateWallet(req);

    return this.db.transaction(async trx => {
      // Create wallet
      const { minimum, settlementAddress } = req;
      console.log("req", req);
      const xpubs = req.xpubs[0] || req.xpubs.join(",");
      const xpubsColdWallets =
        req.xpubsColdWallets[0] || req.xpubsColdWallets.join(",");

      const wallet = {
        ...(await this.wallets.create(
          { service: this.name, xpubs, minimum, xpubsColdWallets },
          trx
        )),
        settlementAddress
      };
      // Derive then update settlement address
      const { address: changeAddress } = await this.generateAddress(
        {
          wallet,
          path: this.addresses.path.SETTLEMENT
        },
        trx
      );

      const { address: coldAddress } = await this.generateColdAddress(
        {
          wallet,
          path: this.addresses.path.COLDWALLET
        },
        trx
      );
      await this.wallets.update(wallet.id, changeAddress, trx);
      await this.addInitFunding(wallet.id, changeAddress, trx);

      return { id: wallet.id, changeAddress, feeAddress: "" };
    });
  }
  // async bundleTransactions(req) {
  //   let { transactions } = req;
  //   const { walletId } = req;
  //   const wallet = await this.wallets.find(walletId);
  //   if (!wallet) {
  //     throw Error('Wallet not found');
  //   }
  //   transactions.forEach((t) => {
  //     // Safe
  //     _.extend(t, {
  //       grossAmount: Decimal(t.grossAmount).mul(BTC_TO_SATOSHI).round(),
  //     });
  //   });
  //   const unspentTxOuts = await this.txOuts.getUnspentWithAddress(wallet.id, this.maximumInput);
  //   // Conver to decimal
  //   unspentTxOuts.forEach((txOut) => {
  //     _.extend(txOut, {
  //       amount: new Decimal(txOut.amount),
  //     });
  //   });
  //   const maximumAmount = unspentTxOuts.reduce(
  //     (acc, txOut) => acc.add(txOut.amount),
  //     new Decimal(0),
  //   ).sub(this.maximumFee);
  //   transactions = utils.capTransactions(transactions, maximumAmount);
  //   if (transactions.length === 0) {
  //     throw Error('Insufficient fund');
  //   }
  //   let total = transactions.reduce(
  //     (acc, t) => acc.add(t.grossAmount),
  //     new Decimal(0),
  //   ).add(this.maximumFee);
  //   const outputs = transactions
  //     .map(t => ({ amount: t.grossAmount.toString(), address: t.toAddress }));
  //   const changeAddress = (await this.addresses.getChange(walletId)).hash;
  //   const inputs = _.compact(unspentTxOuts.map((txOut) => {
  //     if (total.lte(0)) {
  //       return null;
  //     }
  //     const {
  //       id, amount, script, index,
  //     } = txOut;
  //     // Always add change address for fee
  //     if (total.lte(amount)) {
  //       outputs.push({
  //         amount: amount.sub(total).add(this.maximumFee).toString(),
  //         address: changeAddress,
  //         change: true,
  //       });
  //     }
  //     total = total.sub(amount);
  //     return {
  //       id,
  //       transactionHash: txOut.txHash,
  //       outputIndex: index,
  //       amount: amount.toString(),
  //       hdPath: txOut.addressPath,
  //       script,
  //     };
  //   }));
  //   const totalInput = inputs.reduce((acc, i) => acc.add(i.amount), new Decimal(0));
  //   const totalOutput = outputs.reduce(
  //     (acc, o) => acc.add(o.amount),
  //     new Decimal(0),
  //   );

  //   if (!totalInput.eq(totalOutput)) {
  //     throw Error(`Transaction inputs & outputs mismatch ${totalInput} vs ${totalOutput}`);
  //   }

  //   const feePerKb = (await this.getFee()) * 1024;

  //   // Convert to JSON
  //   const result = {
  //     successTransactions: transactions.map(t => t.id),
  //     inputs,
  //     outputs,
  //     feePerKb,
  //   };

  //   return {
  //     payload: JSON.stringify(snakeCaseKeys(result, { deep: true })),
  //   };
  // }

  /* eslint-disable class-methods-use-this */
  async ping() {
    const time = String(new Date().getTime());
    return { time };
  }
  /* eslint-enable class-methods-use-this */
  // async broadcast(req) {
  //   const successTxsHash = {};
  //   await this.db.transaction(async (trx) => {
  //     const payload = JSON.parse(req.payload);
  //     const payloadHex = payload.payload_hex;
  //     const transaction = bitcoin.Transaction.fromHex(payloadHex);
  //     const hash = transaction.getId();
  //     // Add transaction
  //     await this.bundle.add(transaction.getId(), req.payload, trx);
  //     try {
  //       await this.rpc.relayTx(payloadHex);
  //     } catch (res) {
  //       const { error } = JSON.parse(res.cause.message);
  //       throw Error(error.message);
  //     }
  //     // Mark as pending
  //     await this.markAsPending(transaction, trx);
  //     payload.success_transactions.forEach((t) => {
  //       successTxsHash[t.toString()] = hash;
  //     });
  //   });
  //   return { payload: JSON.stringify(successTxsHash) };
  // }

  /* eslint-disable class-methods-use-this */
  async getBalance() {
    throw Error("Not implement");
  }
  /* eslint-enable class-methods-use-this */

  // async getStatus(req) {
  //   const {
  //     walletId,
  //   } = req;

  //   const totalBalance = new Decimal(await this.txOuts
  //     .getTotalBalance(walletId)).div(BTC_TO_SATOSHI).toString();
  //   const availableBalance = new Decimal(await this.txOuts
  //     .getAvailableBalance(walletId)).div(BTC_TO_SATOSHI).toString();
  //   const availableWithdrawal = new Decimal(await this.txOuts
  //     .getWithdrawalBalance(walletId, this.maximumInput)).div(BTC_TO_SATOSHI).toString();

  //   return { totalBalance, availableBalance, availableWithdrawal };
  // }

  async computeTotalBalances(wallet, isColdWallet) {
    const balances = {};
    const { currency } = this;
    const amount = await this.fundings.sumUnspentAmountByWalletIdAndCurrencyWithTypeWallet(
      wallet.id,
      currency,
      isColdWallet
    );
    //.div(BTC_TO_SATOSHI);
    balances[currency] = { amount };
    return balances;
  }

  capTransaction(availableBalances, transactions) {
    const balances = { ...availableBalances };
    const maximumAmount = new Decimal(balances[this.currency].amount)
      .mul(BTC_TO_SATOSHI)
      .sub(this.maximumFee)
      .round();
    let txs = transactions.map(tx => ({
      ...tx,
      amount: new Decimal(tx.amount).round() // satoshis ...
    }));

    let total = new Decimal(0);
    txs = txs.filter(t => {
      total = total.add(t.amount);
      return total.lte(maximumAmount);
    });
    return txs;
  }

  async getMeta(wallet, transactions, isColdWallet = false) {
    if (transactions.length === 0) {
      throw Error("Insufficient fund");
    }
    // transactions: capTransactions ...
    let unspentTxOuts = await this.fundings.findTopUnspentByWalletIdAndCurrencyWithTypeWallets(
      wallet.id,
      this.currency,
      this.maximumInput,
      isColdWallet
    );
    unspentTxOuts = unspentTxOuts.map(tx => ({
      ...tx,
      amount: new Decimal(tx.amount).round() // by satoshis ...
    }));
    // calculate maximumAmount by satoshis ...
    // const maximumAmount = unspentTxOuts.reduce(
    //   (acc, txOut) => acc.add(txOut.amount),
    //   new Decimal(0),
    // );

    // recalculate unspentTxOuts ...

    const estimateFee = await this.api.getSmartFee();
    const feePerByte = estimateFee.feerate * Math.pow(10, 8);
    const total = transactions
      .reduce((acc, t) => acc.add(t.amount), new Decimal(0))
      .add(feePerByte);

    // if (maximumAmount.lt(total)) {
    //   throw Error('Insufficient fund');
    // }
    let sum = new Decimal(0);
    unspentTxOuts = unspentTxOuts.filter(t => {
      if (sum.lte(total)) {
        sum = sum.add(t.amount);
        return true;
      }
      return false;
    });

    if (sum.lte(total)) {
      throw Error("Insufficient fund");
    }

    console.log("feePerByte ", feePerByte);
    const inputs = await Promise.map(unspentTxOuts, async t => {
      const address = await this.addresses.find(t.addressId);
      return {
        script: t.script,
        transactionHash: t.transactionHash,
        outputIndex: t.outputIndex,
        amount: t.amount.toFixed(),
        hdPath: address.path
      };
    });

    const outputs = transactions.map(t => {
      t.amount = t.amount.toFixed();
      return t;
    });
    const result = {
      successTransactions: transactions.map(t => t.id),
      inputs,
      outputs,
      feePerByte: feePerByte
    };
    return result;
  }

  async computeAvailableWithdrawals(wallet, isColdWallet) {
    const balances = {};
    const { currency } = this;
    let utxos = await this.fundings.findTopUnspentByWalletIdAndCurrencyWithTypeWallets(
      wallet.id,
      currency,
      this.maximumInput,
      isColdWallet
    );
    utxos = utxos.map(tx => ({
      ...tx,
      amount: new Decimal(tx.amount)
    }));
    const amount = utxos
      .reduce((acc, t) => acc.add(t.amount), new Decimal(0))
      .div(BTC_TO_SATOSHI)
      .toFixed();
    balances[currency] = { amount };
    return balances;
  }

  async validateAddress(req) {
    const { hash } = req;
    try {
      const address = Address.fromString(hash, "mainnet");
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
      const txDecoded = await this.api.decodeRawTransaction(raw);
      return { transaction_hash: txDecoded.txid };
    } catch (err) {
      return { transaction_hash: null };
    }
  }

  async getTotalBalance(currency, walletId, isColdWallet = true) {
    let totalBalance = "";
    isColdWallet = isColdWallet === "true";
    try {
      console.log("BTC_Service.getTotalBalance");
      const wallet = await this.wallets.find(walletId);
      const balance = await this.computeTotalBalances(wallet, isColdWallet);
      totalBalance = balance.BTC.amount.toString();
    } catch (err) {
      console.log("BTC.getTotalBalance.err:", err);
      totalBalance = "0";
    }
    console.log("BTC.totalBalance:", totalBalance);
    return { currency, totalBalance };
  }

  // Update limit hot wallet
  async updateLimit(req) {
    const { currenciesLimit } = req;
    var status = "Update Ok";
    try {
      await this.db.transaction(async trx => {
        await Promise.each(currenciesLimit, currency =>
          this.limits.update(
            currency.currency,
            currency.walletId,
            currency.limit,
            trx
          )
        );
      });
    } catch (err) {
      console.log("err:", err);
      status = "Update error";
      return { status };
    }
    return { status };
  }

  // Get limit hot wallet
  async getLimit() {
    var currenciesLimit = [];
    var currenciesLimitDb;
    try {
      await this.db.transaction(async trx => {
        currenciesLimitDb = await this.limits.getAll(trx);
      });
      await Promise.each(currenciesLimitDb, currencyDb => {
        var currency = currencyDb.service;
        var walletId = currencyDb.walletId;
        var limit = currencyDb.limits;
        currenciesLimit.push({ currency, walletId, limit });
      });
    } catch (err) {
      console.log("err:", err);
      throw Error(this.error.GET_LIMIT_ERROR);
    }
    return { currenciesLimit };
  }

  // async getLastestBlock (currency )
  // {
  //   const block  = await this.api.getLatestBlockHeight();
  //   return {currency ,block};
  // }

  async signTransactions(payload) {
    const inputXpriv = process.env.BTC_XPRIV;
    const inputs = payload.meta.inputs;
    const outputs = payload.meta.outputs;
    const multiSigTx = new bitcore.Transaction();
    const changeAddress =
      process.env.BTC_SETTLEMENT_ADDRESS ||
      "14n2C7YvjC3TT9DzQah4eZ1a9fcRde4WwJ";

    console.log("settlement addr", process.env.BTC_SETTLEMENT_ADDRESS);
    console.log("reading meta", payload);
    console.log("input meta", inputs);
    console.log("output meta", outputs);

    _.each(inputs, function(input, i) {
      let _input = new bitcore.Transaction.Input.PublicKeyHash({
        output: new bitcore.Transaction.Output({
          script: input.script,
          satoshis: input.amount
        }),
        prevTxId: input.transactionHash,
        outputIndex: input.outputIndex,
        script: Script.empty()
      });
      multiSigTx.addInput(_input);
    });

    _.each(outputs, function(output) {
      console.log("those output", (output.amount * BTC_TO_SATOSHI).toFixed());
      multiSigTx.addOutput(
        new bitcore.Transaction.Output({
          script: Script(new Address(output.address, bitcore.Networks.mainnet)),
          satoshis: (output.amount * BTC_TO_SATOSHI).toFixed()
        })
      );
    });

    const externals = outputs.map((output, index) => ({
      id: output.id,
      index
    }));

    multiSigTx.change(changeAddress);
    multiSigTx.feePerKb(parseInt(process.env.BTC_MAXIMUM_FEE) || 10000);
    const hdPaths = Array.from(new Set(inputs.map(input => input.hdPath)));
    console.log("hdpaths", hdPaths);
    var fee = multiSigTx._getUnspentValue();

    console.log("Est fee is " + multiSigTx.getFee());
    console.log("Actual fee is " + multiSigTx._getUnspentValue());

    if (fee < multiSigTx.getFee()) {
      throw Error("Insufficient fee");
    } else if (fee > 10000000) {
      throw Error("Fee is too high");
    }

    const hdPaths = Array.from(new Set(inputs.map(input => input.hdPath)));

    hdPaths.forEach(hdPath => {
      const path = hdPath.indexOf("m") > -1 ? hdPath : `m/${hdPath}`;
      const privateKey = bitcore.HDPrivateKey(extendprivKey).derive(path)
        .privateKey;
      multiSigTx.sign(privateKey);
    });

    if (multiSigTx.isFullySigned()) {
      console.log("signing success");
      const transactions_hash = [];
      transactions_hash.push({
        externals,
        hash: multiSigTx.serialize()
      });

      output = {
        type: "withdrawal",
        currency,
        transactionsHash: transactions_hash,
        successTransactions: meta.successTransactions
      };

      return output;
    } else {
      throw Error("signing failed", multiSigTx.serialize());
    }
  }
}

module.exports = BtcService;
