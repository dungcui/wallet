const Decimal = require('decimal.js');
const Service = require('../service.js');
const constants = require('./stellar_constants');
const Promise = require('bluebird');
const utils = require('../../utils')

class StellarService extends Service {
  constructor({
    db,
    block,
    token,
    wallet,
    address,
    funding,
    withdrawal,
    stellarApi: api,
    stellarInterpreter: interpreter,
  }) {
    const { NAME: name, CURRENCY: currency, FEE_CURRENCY: feeCurrency } = constants;
    const baseFee = new Decimal(constants.BASE_FEE).div(constants.XLM_TO_STROOPS);
    const error = {
      ALREADY_HAS_WALLET: 'Already has wallet.',
      MISSING_SETTLEMENT_ADDRESS: 'Missing settlement address.',
      INVALID_SETTLEMENT_ADDRESS: 'Invalid settlement address.',
      NOT_ENOUGH_BALANCE : 'Currency is not enough for withdraw',
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

      name,
      error,
      baseFee,
      currency,
      feeCurrency,
      interpreter,
    });
    this.NATIVE_ISSUER = constants.ASSET_TYPE_NATIVE;
  }

  async validateAddress(req) {
    const { hash, currency } = req;
    if (!hash) throw Error(this.error.MISSING_ADDRESS);
    try {
      const addressAndMemo = utils.splitAddressAndMemo(hash)
      const { balances } = await this.api.getAccount(addressAndMemo.address);
      const valid = currency === this.currency ||
        !!balances.find(balance => balance.asset_code === currency);
      return { valid };
    } catch (err) {
      return { valid: false };
    }
  }

  async validateWallet(req) {
    const { settlementAddress } = req;
    if (!settlementAddress) {
      throw Error(this.error.MISSING_SETTLEMENT_ADDRESS);
    }
    const found = await this.wallets.findBySettlementAddress(this.name, settlementAddress);
    if (found) throw Error(this.error.ALREADY_HAS_WALLET);
    try {
      return await this.api.getAccount(settlementAddress);
    } catch (err) {
      throw Error(this.error.INVALID_SETTLEMENT_ADDRESS);
    }
  }

  async bundleWithdrawal(req , isColdWallet = true) {
    const { walletId, transactions } = req;

    if (!transactions || transactions.length === 0) {
      throw Error(this.error.MISSING_TRANSACTIONS);
    }

    const wallet = await this.wallets.find(walletId);
    console.log('wallet:',wallet);
    if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);
    let sumWithDrawReq= 0;
    Promise.each(transactions ,async transaction => 
    {
      sumWithDrawReq += transaction.amount;
    })
    // const unsignedTransactions = await this.capTransaction(transactions);
    var settlementAddress = ""
    if (isColdWallet) {
      settlementAddress = wallet.coldSettlementAddress
    } else { 
      settlementAddress = wallet.settlementAddress
    }
    const balance =  await this.api.getBalance(settlementAddress);
    // Minimum XLM settlement address must maintain
    const minimumBalance = await this.interpreter.computeMinimumBalance(settlementAddress);

    if(( balance - minimumBalance) < sumWithDrawReq )
    throw  Error(this.error.NOT_ENOUGH_BALANCE);

    const payload = {
      type: this.bundleType.WITHDRAWAL,
      currency : this.currency,
      transactions: transactions,
      meta: await this.interpreter.getMeta(settlementAddress,transactions, isColdWallet),
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
    console.log('txsHash:',txsHash)
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

  // Get balance of admin wallet
  // 
  async getTotalBalance (currency , walletId, isColdWallet = true)
  {
    isColdWallet = (isColdWallet==='true');
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
      totalBalance =  await this.api.getBalance(address);
    }
    catch (err){
      console.log('XLM.getTotalBalance.err:',err);
      totalBalance = "0";
    }
    console.log('XLM.totalBalance:',totalBalance);
    return {currency, totalBalance}
  }
}

module.exports = StellarService;
