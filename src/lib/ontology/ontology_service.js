const Service = require('../service');
const { Crypto } = require('ontology-ts-sdk');
const Decimal = require('decimal.js');
const snakeCaseKeys = require('snakecase-keys');
const Promise = require('bluebird');

const { Address } = Crypto;

class OntologyService extends Service {
  constructor({
    db,
    block,
    token,
    ontologyApi,
    wallet,
    funding,
    address,
    withdrawal,
    ontologyConstants,
    ontologyInterpreter,
    ONTOLOGY_BASE_FEE,
    ONTOLOGY_GAS_PRICE,
    ONTOLOGY_GAS_LIMIT,
  }) {
    const error = {
      INVALID_XPUBS: 'Missing xpubs or there are more than 1 xpubs',
      NOT_ENOUGH_BALANCE: 'Not enough balance',
      NOT_ENOUGH_ONG_BALANCE: 'Not enough ONG balance to transfer',
    };

    super({
      db,
      api: ontologyApi,
      block,
      token,
      funding,
      withdrawal,
      name: ontologyConstants.SERVICE_NAME,
      currency: ontologyConstants.CURRENCY,
      interpreter: ontologyInterpreter,
      feeCurrency: ontologyConstants.FEE_CURRENCY,
      baseFee: ONTOLOGY_BASE_FEE,
      feeCurrencyDecimal: ontologyConstants.FEE_CURRENCY_DECIMAL,
      error,
    });

    this.wallets = wallet;
    this.addresses = address;
    this.tokens = token;
    this.constants = ontologyConstants;
    this.gasPrice = Number(ONTOLOGY_GAS_PRICE)
    this.gasLimit = Number(ONTOLOGY_GAS_LIMIT)
  }

  async validateWallet(req) {
    const { xpubs } = req;

    if (!xpubs.length && xpubs.length > 1) throw Error(this.error.INVALID_XPUBS);
    const wallet = await this.wallets.findByXpubs(this.name, xpubs[0]);

    if (wallet) throw Error(this.error.ALREADY_HAS_WALLET);
  }

  // *Processing previous blocks might add duplicate settlement funds
  // async addInitFunding(walletId, settlementAddress, trx) {
  //   const [balance, address] = await Promise.all([
  //     this.api.getBalance(settlementAddress),
  //     this.addresses.findByAddress(walletId, settlementAddress, trx),
  //   ]);

  //   const { CURRENCY, FEE_CURRENCY } = this.constants;
  //   const tmpFunding = {
  //     service: this.constants.SERVICE_NAME,
  //     transactionHash: `addSettlementFunding_${settlementAddress}`,
  //     type: this.fundings.type.FUNDING,
  //     blockHeight: 0,
  //     addressId: address.id,
  //     state: this.fundings.state.CONFIRMED,
  //   };

  //   const ontFunding = Object.assign({
  //     currency: CURRENCY,
  //     amount: balance[CURRENCY.toLowerCase()],
  //     outputIndex: 0,
  //   }, tmpFunding);

  //   const ongFunding = Object.assign({
  //     currency: FEE_CURRENCY,
  //     amount: balance[FEE_CURRENCY.toLowerCase()],
  //     outputIndex: 1,
  //   }, tmpFunding);

  //   await Promise.all([this.fundings.add(ontFunding, trx), this.fundings.add(ongFunding, trx)]);
  // }

  async validateAddress(req) {
    const { hash, currency } = req;
    if (!hash) throw Error(this.error.MISSING_ADDRESS);
    if (!currency || currency.length === 0) throw Error(this.error.MISSING_CURRENCY);

    if (hash.length !== 34) return { valid: false };

    // Only a valid ONT address is serialize-able
    try {
      const address = new Address(hash);
      address.serialize();
    } catch (err) {
      return { valid: false };
    }

    return { valid: true };
  }

  async bundleMoveFund(req) {
    const { walletId, currency } = req;
    const wallet = await this.wallets.find(walletId);
    if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);
    const token =  await this.tokens.find(this.name,currency);
    const unspentMoveFunds = await this.fundings.findAllUnspentMoveFund(wallet, currency);
    const transactions = unspentMoveFunds.map(funding => ({
      id: funding.id,
      fromPath: funding.addressPath,
      toPath: this.addresses.path.SETTLEMENT,
      amount: new Decimal(funding.amount).toFixed(),
      currency,
    }));

    const payload = {
      type: this.bundleType.MOVE_FUND,
      currency,
      transactions,
      meta: await this.interpreter.getMeta(token)
    };
    // const option = { deep: true };
    return { payload: JSON.stringify(payload)};
  }

  async bundleWithdrawal(req, isColdWallet = true) {
    console.log('*---- ONT_Serivce.bundleWithdrawal ----*')
    const { walletId, transactions, currency } = req;
    const token =  await this.tokens.find(this.name,currency);
    const decimal = token.decimals;

    if (!transactions || transactions.length === 0) {
      throw Error(this.error.MISSING_TRANSACTIONS);
    }

    const wallet = await this.wallets.find(walletId);
    if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);
    let sumWithDrawReq= 0;
    await Promise.each(transactions ,async transaction => 
    {
      sumWithDrawReq += transaction.amount;
    })
    let balances = [];
    let balance = 0;
    let balanceONG = 0;
    if(!isColdWallet) {
      balances = await this.api.getBalance(wallet.settlementAddress);
      balance = parseInt(balances[currency.toLowerCase()])/Math.pow(10,decimal);
      // Get Ontology Gas to cover fee
      balanceONG = parseInt(balances['ong'])/Math.pow(10,9);
    } else 
    {
      balances =  await this.api.getBalance(wallet.coldSettlementAddress);
      balance = parseInt(balances[currency.toLowerCase()])/Math.pow(10,decimal);
      // Get Ontology Gas to cover fee
      balanceONG = parseInt(balances['ong'])/Math.pow(10,9);
    }
    console.log('balance:',balance)
    if( balance < sumWithDrawReq )
    throw  Error(this.error.NOT_ENOUGH_BALANCE);
    console.log('base Fee:', this.baseFee);
    console.log('balanceONG:',balanceONG)
    if( balanceONG < this.baseFee )
    throw  Error(this.error.NOT_ENOUGH_ONG_BALANCE);

    const payload = {
      type: this.bundleType.WITHDRAWAL,
      currency,
      transactions: transactions,
      meta: await this.interpreter.getMeta(token),
    };

    console.log("Withdraw payload", JSON.stringify(payload));

    return { payload: JSON.stringify(payload) };
  }

  async broadcast(req) {
    // Read the payload
    const { payload  } = req;
    if (!payload) throw Error(this.error.MISSING_PAYLOAD);

    const { transactionsHash: txsHash } = JSON.parse(payload);
  
    var successTxsHash = [];
    await Promise.each(txsHash, async (txHash) => {
      const { hash, externals } = txHash;
      const transactionHash = await this.api.broadcast(hash);
      if (transactionHash) {
        externals.forEach((external) => {
          successTxsHash.push({
            externalId: external.id,
            transactionHash,
            outputIndex: external.index || 0,
          });
        });
      }
    });
    return { payload: JSON.stringify(successTxsHash) };
  }

  async getTotalBalance (currency , walletId, isColdWallet = true)
  {
    console.log('*---- ONT_Service.gettotalBalance ----*')
    isColdWallet = (isColdWallet==='true');
    const token =  await this.tokens.find(this.name,currency);
    const decimal = token.decimals;
    let totalBalance = "";
    try {
      const wallet = await this.wallets.find(walletId);
      let address ='';
      if(!isColdWallet)
      {
        address = wallet.settlementAddress;
      } else {
        address = wallet.coldSettlementAddress;
      }
      let balance = []
      balance = await this.api.getBalance(address);
      console.log('balance:',balance)
      totalBalance = balance[currency.toLowerCase()]/Math.pow(10,decimal);
      console.log('totalBalance:',totalBalance)
    }
    catch (err){
      console.log('ONT.getTotalBalance.err:',err);
      totalBalance = "0";
    }
    console.log('ONT.totalBalance:',totalBalance);
    return {currency, totalBalance}
  }
}

module.exports = OntologyService;
