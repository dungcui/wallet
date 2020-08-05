const debug = require("debug");
const Promise = require("bluebird");
const { formatAddressWithMemo } = require("../utils");

const keyToken = process.env.KEY_TOKEN;

const reponseUrl = process.env.REPONSE_REQUEST_URL;
const crypto = require("crypto");
class Service {
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
    // logError,
    // Local
    name,
    error,
    baseFee,
    currency,
    feeCurrency,
    interpreter,
    signService

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
    this.limits = limit;
    this.failedApi = failedApi;
    // Configs
    this.name = name;
    this.baseFee = baseFee;
    this.currency = currency;
    this.feeCurrency = feeCurrency;
    this.signService = signService;

    this.debug = debug(`wallet:service:${this.name}`);

    // console.log("signService",signService);

    // this.signService = signService;

    /// for get lastest block
    // this.bchRpc = bchRpc,
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

  async addWallet(req) {
    // Validate req
    await this.validateWallet(req);

    return this.db.transaction(async trx => {
      // Create wallet
      const { minimum, settlementAddress, coldSettlementAddress } = req;
      console.log("req", req);
      const xpubs = req.xpubs[0] || req.xpubs.join(",");
      const xpubsColdWallets =
        req.xpubsColdWallets[0] || req.xpubsColdWallets.join(",");

      const wallet = {
        ...(await this.wallets.create(
          {
            service: this.name,
            xpubs,
            minimum,
            xpubsColdWallets,
            coldSettlementAddress
          },
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
      await this.wallets.updateColdAddress(wallet.id, coldAddress, trx);

      await this.addInitFunding(wallet.id, changeAddress, trx);

      return { id: wallet.id, changeAddress, feeAddress: "" };
    });
  }

  async getLastestBlock(currency) {
    const block = await this.api.getLatestBlockHeight();
    return { currency, height: block };
  }

  async addContractToken(req) {
    // Validate req
    throw Error(this.error.NOT_HAVE_SMART_CONTACT);
  }

  async getBlockInfo(height) {}

  /* eslint-disable no-unused-vars */
  async addInitFunding(walletId, settlementAddress, trx) {
    // This function add settlement's network balance as funding into our system
    // Implement depend on token
  }
  /* eslint-enable no-unused-vars */

  async generateAddress({ wallet, path }, trx) {
    console.log("*---- Service.generateAddress ----*");
    const { address, memo } = await this.interpreter.derive(wallet, path);
    await this.addresses.create(
      {
        path,
        memo,
        address,
        service: this.name,
        walletId: wallet.id,
        type:
          path === this.addresses.path.SETTLEMENT
            ? this.addresses.type.SETTLEMENT
            : path === this.addresses.path.COLDWALLET
            ? this.addresses.type.COLDWALLET
            : this.addresses.type.USER
      },
      trx
    );
    return { address, memo };
  }

  async generateColdAddress({ wallet, path }, trx) {
    const { address, memo } = await this.interpreter.deriveColdAddress(
      wallet,
      path
    );
    await this.addresses.create(
      {
        path,
        memo,
        address,
        service: this.name,
        walletId: wallet.id,
        type:
          path === this.addresses.path.COLDWALLET
            ? this.addresses.type.COLDWALLET
            : this.addresses.type.SETTLEMENT
      },
      trx
    );
    return { address, memo };
  }

  async getAddress(req) {
    const { walletId, path } = req;
    if (!walletId) throw Error(this.error.MISSING_WALLET_ID);
    if (!path) throw Error(this.error.EMPTY_PATH);

    const wallet = await this.wallets.find(walletId);
    if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);

    const { address, memo } =
      (await this.addresses.findByPath(walletId, path)) ||
      (await this.generateAddress({ wallet, path }));

    const hash = memo ? formatAddressWithMemo({ address, memo }) : address;

    this.debug(`Get address of ${walletId} from path m/${path}: ${hash}`);
    return { hash };
  }

  async bundleTransactions(req) {
    const { type, walletId } = req;
    if (!walletId) throw Error(this.error.MISSING_WALLET_ID);

    return type === this.bundleType.MOVE_FUND
      ? this.bundleMoveFund(req)
      : this.bundleWithdrawal(req);
  }

  capTransaction(availableBalances, transactions) {
    const balances = { ...availableBalances };
    console.log("balances", balances);
    console.log("transactions", transactions);
    return transactions.filter(({ currency, amount }) => {
      const { feeCurrency, baseFee } = this;

      if (balances[feeCurrency].amount.lt(baseFee)) return false;
      balances[feeCurrency].amount = balances[feeCurrency].amount.sub(baseFee);

      if (balances[currency].amount.lt(amount)) return false;
      balances[currency].amount = balances[currency].amount.sub(amount);

      return true;
    });
  }

  async catchLogApi(req) {
    console.log("aaaaaaaaaaa", req);
    await this.failedApi.update(req.service, 0, req.body, req.err);
    return { result: "ok" };
  }

  async bundleMoveFund(isColdWallet = true) {
    throw Error(this.error.MOVE_FUND_NOT_IMPLEMENTED);
  }

  async bundleWithdrawal(req, isColdWallet = true) {
    const { walletId, transactions } = req;

    if (!transactions || transactions.length === 0) {
      throw Error(this.error.MISSING_TRANSACTIONS);
    }

    const wallet = await this.wallets.find(walletId);
    if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);

    const availableWithdrawals = await this.computeAvailableWithdrawals(
      wallet,
      isColdWallet
    );
    console.log("availableWithdrawals ", availableWithdrawals);

    const unsignedTransactions = this.capTransaction(
      availableWithdrawals,
      transactions
    );
    console.log("wallet", wallet);
    console.log("availableWithdrawals", availableWithdrawals);
    console.log("unsignedTransactions", unsignedTransactions);

    const payload = {
      type: this.bundleType.WITHDRAWAL,
      transactions: transactions,
      meta: await this.getMeta(wallet, unsignedTransactions, isColdWallet)
    };

    console.log("Withdraw payload", JSON.stringify(payload));

    return { payload: JSON.stringify(payload) };
  }

  async getIssuer(currency) {
    const tokens = this.tokens
      .getAllByService(this.name)
      .map(token => token.currency);

    return tokens.indexOf(currency) > -1
      ? (await this.tokens.find(this.name, currency)).address
      : this.NATIVE_ISSUER;
  }

  async computeTotalBalances(wallet) {
    const balances = {};
    const tokens = this.tokens.getAllByService(this.name);
    const currencies = [...tokens.map(token => token.currency), this.currency];
    await Promise.each(currencies, async currency => {
      const amount = await this.fundings.sumUnspentAmountByWalletIdAndCurrency(
        wallet.id,
        currency
      );
      const issuer = await this.getIssuer(currency);
      balances[currency] = { amount, issuer };
    });
    return balances;
  }

  async computeAvailableBalances(wallet, totalBalances) {
    // This should deduct pending withdrawals
    // But we couldn't track these pending currently
    // Will deduct after we update our model
    // by adding walletId to funding table
    return totalBalances;
  }

  async computeAvailableWithdrawals(wallet, isColdWallet = true) {
    console.log("Service.computeAvailableWithdrawals");
    const balances = {};
    const tokens = this.tokens.getAllByService(this.name);
    const currencies = [...tokens.map(token => token.currency), this.currency];
    const { address: settlementAddress } = await this.addresses.findByPath(
      wallet.id,
      isColdWallet
        ? this.addresses.path.COLDWALLET
        : this.addresses.path.SETTLEMENT
    );

    await Promise.each(currencies, async currency => {
      const amount = await this.fundings.sumUnspentAmountByAddressAndCurrency(
        settlementAddress,
        currency
      );
      const issuer = await this.getIssuer(currency);
      balances[currency] = { amount, issuer };
    });
    console.log("balances:", balances);
    return balances;
  }

  async getStatus(req) {
    const { walletId, currency } = req;
    if (!walletId) throw Error(this.error.MISSING_WALLET_ID);

    const wallet = await this.wallets.find(walletId);
    if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);

    const totalBalances = await this.computeTotalBalances(wallet);
    const availableBalances = await this.computeAvailableBalances(
      wallet,
      totalBalances
    );
    const availableWithdrawals = await this.computeAvailableWithdrawals(
      wallet,
      availableBalances
    );

    return {
      totalBalance: totalBalances[currency].amount.toFixed(),
      availableBalance: availableBalances[currency].amount.toFixed(),
      availableWithdrawal: availableWithdrawals[currency].amount.toFixed()
    };
  }

  async checkDuplicatedWithdrawal(externalId, transactionHash, trx) {
    const a = await this.withdrawals.findAllByTransactionHash(
      this.name,
      transactionHash,
      trx
    );

    const b = await this.withdrawals.findAllByExternalId(
      this.name,
      externalId,
      trx
    );
    console.log("a :", a);
    console.log("b :", b);

    const submittedWithdrawals = transactionHash
      ? await this.withdrawals.findAllByTransactionHash(
          this.name,
          transactionHash,
          trx
        )
      : await this.withdrawals.findAllByExternalId(this.name, externalId, trx);
    return submittedWithdrawals;
  }

  async broadcastAndCreateWithdrawal(externals, rawTransaction) {
    console.log("Service.broadcastAndCreateWithdrawal");
    const transaction = await this.interpreter.deserializeTx(rawTransaction);
    return this.db.transaction(async trx => {
      const { transactionHash } = transaction;
      try {
        // Check duplicate
        try {
          await Promise.each(externals, async external => {
            await this.checkDuplicatedWithdrawal(
              external.id,
              transactionHash,
              trx
            );
          });
        } catch (err) {
          this.debug(err.stack);
        }
        // broadcast transaction ...
        let response = null;
        try {
          response = await this.api.broadcast(rawTransaction);
        } catch (err) {
          console.log("err:", err);
          throw Error(
            `Broadcast fail ${transactionHash} ${transaction} with error ${err}`
          );
        }
        // console.log("response", response);
        const withdrawals = await this.interpreter.buildBroadcastedWithdrawals(
          transaction,
          response
        );
        const inputWithdrawals = await this.interpreter.buildInputWithdrawals(
          transaction,
          response
        );
        console.log("withdrawals:", withdrawals);
        // Create withdrawals from transaction
        await Promise.each(withdrawals, async withdrawal => {
          if (!response) {
            return;
          }
          const extractExternals = externals.filter(
            external =>
              (external.index >= 0 &&
                external.index === withdrawal.outputIndex) ||
              !external.index
          );
          await Promise.each(extractExternals, async extractExternal => {
            this.withdrawals.add(
              {
                externalId: extractExternal.id || null,
                service: this.name,
                amount: withdrawal.amount,
                currency: withdrawal.currency,
                toAddress: withdrawal.toAddress,
                outputIndex: withdrawal.outputIndex,
                state: this.withdrawals.state.PENDING,
                transactionHash: transactionHash || withdrawal.transactionHash
              },
              trx
            );
          });
          await Promise.each(inputWithdrawals, async input => {
            const unconfirmWithdraw = await this.fundings.find(
              this.name,
              input.txid,
              input.vout
            );
            console.log("unconfirmWithdraw", unconfirmWithdraw);
            await this.fundings.maskAsUnconfirmWithdraw(unconfirmWithdraw.id);
          });
        });
        if (response) {
          return transactionHash || withdrawals[0].transactionHash;
        }
      } catch (error) {
        this.debug(
          `Broadcast fail ${transactionHash} ${transaction} with error ${error}`
        );
        this.debug(error.stack);
        throw Error(
          `Broadcast fail ${transactionHash} ${transaction} with error ${error}`
        );
      }
    });
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

  async sendTransactions(req) {
    console.log("*---- Service.sendTransaction ----*");

    // console.log('req:',req)
    const payload = await this.bundleWithdrawal(req);
    const transaction = JSON.parse(payload.payload);
    console.log("Service.transaction:", transaction);
    const txsHash = await this.signTransactions(transaction);
    console.log("txsHash:", txsHash);
    await Promise.each(txsHash, async txHash => {
      const { externals, hash } = txHash;
      const result = await this.api.broadcast(hash);
      console.log("result", result);
    });
  }

  async autoMoveFundsTransaction(req) {
    console.log("*---- Service.autoMoveFundsTransaction ----*");
    console.log("reading request", req);

    const bundleType = "move_fund";
    const { walletId, transactions, address } = req;
    const wallet = await this.wallets.find(walletId);

    if (!transactions || transactions.length === 0) {
      throw Error(this.error.MISSING_TRANSACTIONS);
    }

    if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);

    const availableWithdrawals = await this.computeAvailableWithdrawals(wallet);
    console.log("availableWithdrawals ", availableWithdrawals);

    const unsignedTransactions = await this.capTransaction(
      availableWithdrawals,
      transactions,
      bundleType
    );
    const getMeta = await this.getMetaAutoMoveFundsTransaction(
      wallet,
      unsignedTransactions,
      address
    );
    console.log("available withdraw", availableWithdrawals);
    console.log("unsign transaction", unsignedTransactions);
    console.log("get meta", getMeta);

    const payload = {
      type: this.bundleType.MOVE_FUND,
      transactions: unsignedTransactions,
      meta: getMeta
    };

    console.log("service payload", payload);
    const txsHash = await this.signAutoMoveFundsTransactions(
      payload,
      bundleType
    );
    console.log("hash from tx", txsHash);
    // await Promise.each(txsHash, async(txHash) => {
    //   const { externals, hash } = txHash;
    //   const result = await this.api.broadcast(hash);
    //   console.log("result", result);
    // });
  }

  async autoMoveFundsSmartContract(req) {
    console.log("*---- Service.autoMoveFundsSmartContract ----*");
  }

  async getMetaAutoMoveFundsTransaction(wallet, transactions, currentAddress) {
    console.log("*---- Service.getMetaMoveFundsTransaction ----*");
  }

  async signTransactions(transaction) {
    console.log("*---- Service.signTransactions ----*");
    throw Error(this.error.CURRENCY_NOT_IMPLEMENT);
  }

  async getSmartContractCurrency(serviceName, contractAddress) {
    console.log("getSmartContractCurrency...");
  }

  // Get balance of admin wallet (spent wallet like BTC)
  async getTotalBalance(currency, walletId) {
    throw Error(this.error.GET_TOTAL_BALANCE_NOT_IMPLEMENTED);
  }

  // Update limit hot wallet
  async updateLimit(req) {
    console.log("Service.req:", req);
  }

  // get limit hot wallet
  async getLimit() {
    console.log("Service.getLimit");
  }

  // async sendParams(req) {
  //   console.log('*---- Service.sendTransaction ----*');
  //   // console.log('req:',req)
  //   const hash = req.hash;
  //   console.log("keyHashEC",keyHashEC);
  //   var decryptedReq = aes256.decrypt(keyHashEC, hash);
  //   console.log("decryptedReq",decryptedReq);
  //   console.log('*---- Service.sendTransaction ----*');
  //   const payload = await this.bundleWithdrawal(req);
  //   const transaction = JSON.parse(payload.payload);
  //   // console.log('Service.transaction:',transaction);
  //   const txsHash = await this.signTransactions(transaction);
  //   console.log('txsHash:', txsHash);
  //   await Promise.each(txsHash, async (txHash) => {
  //     const { externals, hash } = txHash;
  //     const result = await this.api.broadcast(hash);
  //     console.log("result", result);
  //   });
  // }

  async autoMoveFundsTransaction(req) {
    console.log("*---- Service.autoMoveFundsTransaction ----*");
    console.log("reading request", req);

    const bundleType = "move_fund";
    const { walletId, transactions, address } = req;
    const wallet = await this.wallets.find(walletId);

    if (!transactions || transactions.length === 0) {
      throw Error(this.error.MISSING_TRANSACTIONS);
    }

    if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);

    const availableWithdrawals = await this.computeAvailableWithdrawals(wallet);
    console.log("availableWithdrawals ", availableWithdrawals);

    const unsignedTransactions = await this.capTransaction(
      availableWithdrawals,
      transactions,
      bundleType
    );
    const getMeta = await this.getMetaAutoMoveFundsTransaction(
      wallet,
      unsignedTransactions,
      address
    );
    console.log("available withdraw", availableWithdrawals);
    console.log("unsign transaction", unsignedTransactions);
    console.log("get meta", getMeta);

    const payload = {
      type: this.bundleType.MOVE_FUND,
      transactions: unsignedTransactions,
      meta: getMeta
    };

    console.log("service payload", payload);
    const txsHash = await this.signAutoMoveFundsTransactions(
      payload,
      bundleType
    );
    console.log("hash from tx", txsHash);
    // await Promise.each(txsHash, async(txHash) => {
    //   const { externals, hash } = txHash;
    //   const result = await this.api.broadcast(hash);
    //   console.log("result", result);
    // });
  }

  async autoMoveFundsSmartContract(req) {
    console.log("*---- Service.autoMoveFundsSmartContract ----*");
  }

  async getMetaAutoMoveFundsTransaction(wallet, transactions, currentAddress) {
    console.log("*---- Service.getMetaMoveFundsTransaction ----*");
  }

  async signTransactions(transaction) {
    console.log("*---- Service.signTransactions ----*");
    throw Error(this.error.CURRENCY_NOT_IMPLEMENT);
  }

  async getSmartContractCurrency(serviceName, contractAddress) {
    console.log("getSmartContractCurrency...");
  }

  // Get balance of admin wallet (spent wallet like BTC)
  async getTotalBalance(currency, walletId) {
    throw Error(this.error.GET_TOTAL_BALANCE_NOT_IMPLEMENTED);
  }

  // Get balance of admin wallet (spent wallet like BTC)
  async getTotalBalance(currency, walletId, isColdWallet = true) {
    throw Error(this.error.GET_TOTAL_BALANCE_NOT_IMPLEMENTED);
  }

  async withdrawCurrency(rawBody, req, signature) {
    console.log("signature", signature);
    console.log("body", JSON.stringify(req));

    const hmac = crypto.createHmac("sha256", keyToken);
    hmac.update(rawBody);
    const hash = hmac.digest("hex");
    console.log("Method 2: ", hash);
    const encypHash = hash;
    if (encypHash !== signature) {
      throw Error(this.error.ERR_501);
    } else {
      const { type, walletId, transactions } = req;
      if (!walletId) throw Error(this.error.MISSING_WALLET_ID);
      try {
        const withdrawaled = await Promise.map(
          transactions,
          async transaction => {
            const found = await this.withdrawals.findAllByExternalId(
              this.name,
              transaction.id
            );
            console.log(
              "found",
              found,
              "this.name",
              this.name,
              "transaction.id",
              transaction.id
            );
            if (found.length > 0) {
              const successTxsHash = {
                externalId: found[0].externalId,
                transactionHash: found[0].transactionHash,
                outputIndex: found[0].index || 0
              };
              return successTxsHash;
            }
          }
        );
        let filterDulicated = await Promise.filter(
          withdrawaled,
          async dulicated => {
            if (dulicated) {
              return dulicated;
            }
          }
        );
        console.log("filterDulicated :", filterDulicated);
        if (filterDulicated.length) {
          return { payload: JSON.stringify(filterDulicated) };
        }
      } catch (err) {
        console.log("err", err);
        throw Error(this.error.DUPLICATED_WITHDRAWAL);
      }
      const payload =
        type === this.bundleType.MOVE_FUND
          ? await this.bundleMoveFund(req)
          : await this.bundleWithdrawal(req, false);
      // console.log("payload",payload.payload);
      // const Signer = new SignService();
      // console.log("Signer", Signer);
      try {
        const body = {
          currency: this.currency,
          transactions: JSON.parse(payload.payload)
        };
        // console.log("body", JSON.stringify(body));

        const signedHash = await this.signService.getSignedHashs(
          JSON.stringify(body)
        );
        // console.log("signedHash", signedHash);
        // const bodyResult = JSON.parse(signedHash);
        if (signedHash.status === "Success") {
          const payloadBroadcast = {
            currency: signedHash.output.currency,
            payload: JSON.stringify(signedHash.output)
          };
          //externalId: external.id,
          //transactionHash,
          //outputIndex: external.index || 0
          // console.log("payloadBroadcast", payloadBroadcast);
          let payload = await this.broadcast(payloadBroadcast);
          let jsonPayload = JSON.parse(payload.payload);
          console.log("jsonPayload", jsonPayload);
          await Promise.each(jsonPayload, async reponse => {
            const hmacReponse = crypto.createHmac("sha256", keyToken);
            hmacReponse.update(
              JSON.stringify({
                transactionHash: reponse.transactionHash,
                externalId: reponse.externalId
              })
            );
            const hashReponse = hmacReponse.digest("hex");
            const result = await this.resultReponse(
              JSON.stringify({
                transactionHash: reponse.transactionHash,
                externalId: reponse.externalId
              }),
              hashReponse
            );
            console.log("aa: ", result);
          });
        }
      } catch (er) {
        console.log("err", er);
        throw Error(er.message);
      }
    }
  }

  async resultReponse(body, signature) {
    console.log("*----- WORKER.CALL -----*");
    console.log("body:", body);
    // console.log('signature:',signature)
    const method = "POST";
    const headers = {
      "Content-Type": "application/json",
      SIGNATURE: signature
    };
    const options = { method, body, headers };
    return await fetch(reponseUrl, options);
  }
}

module.exports = Service;
