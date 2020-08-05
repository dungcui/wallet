const Promise = require('bluebird');
const _ = require('lodash');
const snakeCaseKeys = require('snakecase-keys');
const debug = require('debug')('wallet:neo_service');
const utils = require('../../utils');
const constants = require('./neo_constants');
const Service = require('../service');
const Decimal = require('decimal.js');
const neoControl = require('./neo_control');

class NeoService extends Service {
  constructor({
    db,
    block,
    token,
    wallet,
    address,
    funding,
    withdrawal,
    neoApi: api,
    neoInterpreter: interpreter,
    neoMaximumInput,
    neoMaximumFee,
  }) {
    const error = {
      INVALID_XPUBS: 'Missing xpubs or there are more than 1 xpubs',
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
      interpreter,
    });
    this.maximumFee = Number(neoMaximumFee);
    this.maximumInput=Number(neoMaximumInput);
  }

  async validateWallet(req) {

  }

  /* eslint-disable class-methods-use-this */
  async ping() {
    const time = String(new Date().getTime());
    return { time };
  }

  /* eslint-disable class-methods-use-this */
  async getBalance() {
    throw Error('Not implement');
  }

  async computeTotalBalances(wallet, isColdWallet) {
    const balances = {};
    const { currency } = this;
    const amount = await this.fundings
    .sumUnspentAmountByWalletIdAndCurrencyWithTypeWallet(wallet.id, currency, isColdWallet)
    balances[currency] = { amount };
    return balances;
  }

  async bundleWithdrawal(req) {
    const { walletId, transactions } = req;

    if (!transactions || transactions.length === 0) {
      throw Error(this.error.MISSING_TRANSACTIONS);
    }

    const wallet = await this.wallets.find(walletId);
    if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);

    const availableWithdrawals = await this.computeAvailableWithdrawals(wallet,transactions[0].currency);
    const unsignedTransactions = this.capTransaction(availableWithdrawals, transactions);
    console.log("wallet", wallet);
    console.log("availableWithdrawals", availableWithdrawals);    
    console.log("unsignedTransactions", unsignedTransactions)
    
    const payload = {
      type: this.bundleType.WITHDRAWAL,
      transactions: transactions,
      meta: await this.getMeta(wallet, unsignedTransactions),
    };

    console.log("Withdraw payload", JSON.stringify(payload));

    return { payload: JSON.stringify(payload) };
  }


  async getMeta(wallet, transactions, bundleType) {
    if (transactions.length === 0) {
      throw Error('Insufficient fund');
    }

    if (bundleType === "move_fund") {
      this.maximumFee = 0;
    }
    // transactions: capTransactions ...
    console.log("wallet.settlementAddress",wallet.settlementAddress);
    console.log("currencty ",transactions[0].currency);
    console.log("this.maximumInput ",this.maximumInput);

    const smartContract = await this.tokens.findContractByCurrencyAndService(this.name, 
      transactions[0].currency);

      let unspentTxOuts = await this.fundings.findAllUnspentByAddressAndCurrencyAndMaxInput(
        wallet.settlementAddress,
        transactions[0].currency,
        this.maximumInput,
      );

    unspentTxOuts = unspentTxOuts.map(tx => ({
      ...tx,
      amount: new Decimal(tx.amount)
    }));
    console.log("unspentTxOuts",unspentTxOuts);
    console.log("transact", transactions);

    const total = transactions.reduce((acc, t) => acc.add(t.amount), 
      new Decimal(0)).add(this.maximumFee);

    let sum = new Decimal(0);
    unspentTxOuts = unspentTxOuts.filter((t) => {
      if (sum.lte(total)) {
        sum = sum.add(t.amount);
        return true;
      }
      return false;
    });

    console.log("total is " + total);
    console.log("sum is " + sum);

    // Neo movefund use lt not lte cuz 0 fee 
    if (sum.lt(total)) {
      throw Error('Insufficient fund');
    }
    const inputs = await Promise.map(unspentTxOuts, async (t) => {
      // const address = await this.addresses.find(t.addressId);
      return {
        script: t.script,
        transactionHash: t.transactionHash.substring(2),
        outputIndex: t.outputIndex,
        amount: new Decimal((new Decimal(t.amount))),
        contractAddress: smartContract.address,
      };
    });

    let outputs = transactions.map((t) => {
      t.amount = new Decimal(new Decimal(t.amount)).toFixed();
      return {
        ...t,
      };
    });

    const result = {
      successTransactions: transactions.map(t => t.id),
      inputs,
      outputs,
    };

    return result;
  }

  async autoMoveFundsSmartContract(req)
  {
    console.log('*---- Service.autoMoveFundsSmartContract ----*');
    
    this.currency = req.currency;
    const bundleType = "move_fund";
    const { walletId, transactions, address, contractAddress } = req;
    const wallet = await this.wallets.find(walletId);
    console.log("this currency", this.currency);

    console.log("transactions", transactions);

    if (!transactions || transactions.length === 0) {
      throw Error(this.error.MISSING_TRANSACTIONS);
    }

    if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);

    const availableWithdrawals = await this.computeAvailableMoveFundsSmartContract(wallet, contractAddress);
    console.log("available withdraw", availableWithdrawals);
    const unsignedTransactions = await this.capTransaction(availableWithdrawals, 
      transactions, bundleType);
    console.log("unsign transaction", unsignedTransactions)
    const getMeta = await this.getMetaAutoMoveFundsSmartContract(wallet, 
      unsignedTransactions, contractAddress, bundleType);
    console.log("available withdraw", availableWithdrawals);

    console.log("get meta", getMeta);
 
    const payload = {
      fromAddress: address,
      type: this.bundleType.MOVE_FUND,
      transactions: unsignedTransactions,
      meta: getMeta
    };

    let result = "";
    console.log('service payload', payload);
    const txsHash = await this.signAutoMoveFundsTransactions(payload, bundleType);
    console.log("hash from tx", txsHash);
    await Promise.each(txsHash, async(txHash) => {
      const { externals, hash } = txHash;
      const _result = await this.api.broadcast(hash);
      result += _result;
      console.log("each result", _result);
    });

    return result;
  }


  async getMetaAutoMoveFundsSmartContract(wallet, transactions, 
    contractAddress, bundleType) {
    console.log("Neo getMetaAutoMoveFundsSmartContract...");

    if (transactions.length === 0) {
      throw Error('Insufficient fund');
    }

    if (bundleType === "move_fund") {
      this.maximumFee = 0;
    }

    const smartContract = await this.getSmartContractCurrency(this.name, 
      contractAddress);

    const currency = smartContract.currency;

    let unspentTxOuts = await this.fundings.findNewestUnspentByWalletIdAndCurrency(
      wallet.service,
      currency,
      1
    );

    console.log("unspentTxOuts" ,unspentTxOuts);

    unspentTxOuts = unspentTxOuts.map(tx => ({
      ...tx,
      amount: new Decimal(tx.amount)
    }));

    console.log("transact", transactions);

    const total = transactions.reduce((acc, t) => acc.add(t.amount), 
      new Decimal(0)).add(this.maximumFee);

    let sum = new Decimal(0);
    unspentTxOuts = unspentTxOuts.filter((t) => {
      if (sum.lte(total)) {
        sum = sum.add(t.amount);
        return true;
      }
      return false;
    });

    console.log("total is " + total);
    console.log("sum is " + sum);

    // Neo movefund use lt not lte cuz 0 fee 
    if (sum.lt(total)) {
      throw Error('Insufficient fund');
    }

    const inputs = await Promise.map(unspentTxOuts, async (t) => {
      const address = await this.addresses.find(t.addressId);
      return {
        script: t.script,
        transactionHash: t.transactionHash,
        outputIndex: t.outputIndex,
        amount: new Decimal((new Decimal(t.amount))),
        hdPath: address.path,
      };
    });

    let outputs = []; 
    
    transactions.forEach(tx => {
      let _output = {
        ...tx,
        contractAddress: contractAddress
      }
      outputs.push(_output);
    }); 

    const result = {
      successTransactions: transactions.map(t => t.id),
      inputs,
      outputs,
    };

    return result;
  }

  async computeAvailableWithdrawals(wallet,currency) {
    const balances = {};
    // const { currency } = this;

    let utxos = await this.fundings.findTopUnspentByWalletIdAndCurrency(
      wallet.id,
      currency,
      this.maximumInput,
    );

    utxos = utxos.map(tx => ({
      ...tx,
      amount: new Decimal(tx.amount),
    }));
    
    const amount = utxos
      .reduce((acc, t) => acc.add(t.amount), new Decimal(0));
      // .mul(constants.BTC_TO_SATOSHI)
    balances[currency] = { amount };

    return balances;
  }

  async computeAvailableMoveFundsSmartContract(wallet, contractAddress,trx) {
    console.log("Neo computeAvailableMoveFundsSmartContract...");
    const smartContract = await this.getSmartContractCurrency(this.name, 
      contractAddress,trx);
    const balances = {};
    const currency = smartContract.currency;
    console.log("currency",currency);
    console.log("smartContract",smartContract);
    console.log("wallet",wallet.id);



    const utxos = await this.fundings.findNewestUnspentByWalletIdAndCurrency(
      wallet.service,
      currency,
      1,
      trx,
    );
    console.log("utxos",utxos);
    const utxos2 = utxos.map(tx => ({
      ...tx,
      amount: new Decimal(tx.amount),
    }));
    
    const amount = utxos2.reduce((acc, t) => 
      acc.add(t.amount), new Decimal(0));

    balances[currency] = { amount };

    console.log("balances available " + amount);

    return balances;
  }

  /* eslint-enable class-methods-use-this */
  async validateAddress(req) {
    const { hash } = req;
    try {

      const {isvalid} =await this.api.validateAddress(hash);
      if(isvalid) return { valid: true };
    } catch (err) {
      return { valid: false };
    }
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
    // const object = utils.getObject(address, 'decimals()', []);
    // const hex = await this.api.ethCall(object);
    // const decimals = new Decimal(hex).toNumber();
    const wallet = await this.wallets.findByService(this.name);

    // If couldn't get decimals from blockchain -> throw error
    // if (!decimals) {
    //   throw new Error(`Could not find decimals of the contract address ${address}`);
    // }

    // Add to db
    await this.db.transaction(async (trx) => {
    // console.log({address, token ,decimals})
    await this.tokens.createWithEnable({ service:currency, address, 
      currency: smartContract, enabled:true, decimals : null }, trx);
    });
   
    return { id: wallet.id, token: smartContract, address: address};
  }  

  async signAutoMoveFundsTransactions(input, bundleType) {
    console.log("Neo signAutoMoveFundsTransactions...")
    console.log("reading auto movefund input", bundleType, input);
    const inputs = input.meta.inputs;
    const outputs = input.meta.outputs;
    const changeAddress = process.env.NEO_SETTLEMENT_ADDRESS || "12mbxsHnYWf6FnijSEwXKi45Br4B3WbsbM";

    const rawTxOutputs = await this.createAutoMoveFundsTransactions(
      inputs,
      outputs,
      input.fromAddress
    )

    console.log("rawTxOutputs", rawTxOutputs);

    let transactionsHashes = [];
    await Promise.each(rawTxOutputs, async(output) => {
      const externals = [{ id: output.id }];
      transactionsHashes.push({
        externals,
        hash: output.rawTx
      });
    });

    console.log("transactionsHashes", transactionsHashes);

    return transactionsHashes;
  }

  async createAutoMoveFundsTransactions(inputs, outputs, fromAddress) {
    console.log("Neo createAutoMoveFundsTransactions...");

    const { default: Neon, api, wallet } = require("@cityofzion/neon-js");
    const apiProvider = new api.neoscan.instance("MainNet");
   
    console.log("reading inputs", inputs);
    console.log("reading outputs", outputs);
    const privateKey = await this.api.getPrivateKey(fromAddress, 1);
    const fromAccount = new wallet.Account(privateKey);

    const txOptions = {
      api: apiProvider, 
      account: fromAccount, 
      intents: [], 
      data: outputs,
      unspent: inputs,
      key: privateKey
    };

    console.log("tx option", txOptions);
    const result = await neoControl.sendAsset(txOptions);

    return result;
  }

  async addWallet(req) {
    console.log('*---- NEO.addWallet ----*');
    // Validate req
    await this.validateWallet(req);

    return this.db.transaction(async (trx) => {
      // Create wallet
      const { minimum, settlementAddress } = req;
      const xpubs = req.xpubs[0] || req.xpubs.join(',');
      const wallet = {
        ...(await this.wallets.create({ service: this.name, xpubs, minimum }, trx)),
        settlementAddress,
      };
      
      const { address: changeAddress } = await this.generateSettlementAddress({
        wallet,
        path: this.addresses.path.SETTLEMENT},
        trx
      );

      await this.wallets.update(wallet.id, changeAddress, trx);
      await this.addInitFunding(wallet.id, changeAddress, trx);

      return { id: wallet.id, changeAddress, feeAddress: '' };
    })
  }

  async generateSettlementAddress({ wallet, path }, trx) {
    //NEO using movefund, adding wallet will return a settlement address
    console.log('*---- NEO.generateSettlementAddress ----*');
    const { address, memo } = { address: wallet.settlementAddress, memo: null };
    await this.addresses.create({
      path,
      memo,
      address,
      service: this.name,
      walletId: wallet.id,
      type: path === this.addresses.path.SETTLEMENT
        ? this.addresses.type.SETTLEMENT
        : this.addresses.type.USER}, 
      trx
    );

    return { address, memo };
  }

  // async getAddress(req) {
  //   console.log('*---- NEO.getAddress ----*');
  //   const { walletId, path } = req;
  //   if (!walletId) throw Error(this.error.MISSING_WALLET_ID);

  //   const wallet = await this.wallets.find(walletId);
  //   if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);

  //   const { address, memo } = await this.generateAddress({ wallet, path });
  //   const hash = memo ? formatAddressWithMemo({ address, memo }) : address;

  //   this.debug(`Get address of ${walletId} from path m/${path}: ${hash}`);
  //   return { hash };

  // }

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

  async getSmartContractCurrency(serviceName, contractAddress) {
  return await this.tokens.findContractByAddressAndService(
    serviceName,
    contractAddress);
  }


  capTransaction(availableBalances, transactions, bundleType) {
    console.log("Neo capTransaction...");
    const balances = { ...availableBalances };
    const currency = transactions[0].currency;
    console.log("txs is", transactions);
    console.log("balances",balances);

    return transactions.filter(({ amount }) => {
      if (typeof bundleType !== 'undefined' && bundleType === "withdraw") {
        if (balances[currency].amount.lt(amount)) return false;
      }

      balances[currency].amount = balances[currency].amount.sub(amount);
      return true;
    });
  }


  async broadcastAndCreateWithdrawal(externals, rawTransaction) {
    console.log('Neo_service.broadcastAndCreateWithdrawal');
    //const transaction = await this.interpreter.deserializeTx(rawTransaction);
    // const transaction = rawTransaction.txid;
    // console.log('transaction:',transaction);
    return this.db.transaction(async (trx) => {
      const  transactionHash  = rawTransaction.txid;
      try {
        // Check duplicate
        try {
          await Promise.each(externals, async (external) => {
            await this.checkDuplicatedWithdrawal(external.id, transactionHash, trx);
          });
        } catch (err) {
          this.debug(err.stack);
        }
        // broadcast transaction ...
        let response = null;
        try {
          response = await this.api.broadcast(rawTransaction.hash);
          console.log("response",response);
        } catch (err) {
          console.log('err:',err)
          response = null;
        }
        const withdrawals = await this.interpreter.buildBroadcastedWithdrawals(rawTransaction.currency,rawTransaction.txid);
        console.log('withdrawals:',withdrawals);
        // Create withdrawals from transaction
        // await Promise.each(withdrawals, async (withdrawal) => {
        //   if (!response) {
        //     return;
        //   }
          const extractExternals = externals.filter(external =>
            (external.index >= 0 && external.index === withdrawals.outputIndex) || !external.index);
          await Promise.each(extractExternals, async (extractExternal) => {
            this.withdrawals.add(
              {
                externalId: extractExternal.id || null,
                service: this.name,
                amount: 0,
                currency: withdrawals.currency,
                toAddress: 'NA',
                outputIndex: withdrawals.outputIndex,
                state: this.withdrawals.state.PENDING,
                transactionHash: transactionHash || withdrawals.transactionHash,
              },
              trx,
            );
          });
        console.log('rawTransaction:',rawTransaction);
        return rawTransaction.txid ;
      } catch (error) {
        this.debug(`Broadcast fail ${transactionHash} ${transaction} with error ${error}`);
        this.debug(error.stack);
        return null;
      }
    });
  }

  // Get balance of settlement address (admin wallet)
  async getTotalBalance (currency , walletId, isColdWallet = true)
  {
    console.log('NEO.getTotalBalance:');
    isColdWallet = (isColdWallet==='true');
    let totalBalance = "";
    try
    {
      const wallet = await this.wallets.find(walletId);
      let address= '' ;
      if(!isColdWallet)
      {
        address = wallet.settlementAddress;
      } else 
      {
        address = wallet.coldSettlementAddress;
      }
      const getUnspents = await this.api.getUnspents(address);
      console.log('getUnspents:', getUnspents);
      await Promise.each(getUnspents.balance, async(balance) => {
        const { asset, amount } = balance;
        if (asset == currency)
        {
          totalBalance = amount.toString();
        } else 
        {
          totalBalance=0;
        }
      });
      // const totalBalance = this.web3.utils.fromWei(balance, "gwei");
    } catch (err){
      console.log('NEO.getTotalBalance.err:',err);
      totalBalance = 0;
    }
    console.log('NEO.totalBalance:',totalBalance);
    return {currency, totalBalance}
  }
}

module.exports = NeoService;
