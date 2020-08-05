const Decimal = require('decimal.js');
const Service = require('../service.js');
const constants = require('./bnb_constants');
const Promise = require('bluebird');
const utils = require('../../utils.js');

class BnbService extends Service {
  constructor({
    db,
    block,
    token,
    wallet,
    address,
    funding,
    withdrawal,
    bnbRpc: api,
    bnbInterpreter: interpreter,

    
  }) {
    const {  NAME: name, CURRENCY: currency, FEE_CURRENCY: feeCurrency } = constants;
    const baseFee = new Decimal(constants.BASE_FEE);
    const error = {
      ALREADY_HAS_WALLET: 'Already has wallet.',
      MISSING_SETTLEMENT_ADDRESS: 'Missing settlement address.',
      INVALID_SETTLEMENT_ADDRESS: 'Invalid settlement address.',
       NOT_ENOUGH_BALANCE : 'Currency is not enough for withdraw'

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
  }

  async validateAddress(req) {
    const { hash } = req;
    const addressAndMemo= utils.splitAddressAndMemo(hash);
    if (!hash) throw Error(this.error.MISSING_ADDRESS);
    try {
      const valid = await this.api.accountExist(addressAndMemo.address);
      return { valid };
    } catch (err) {
      return { valid: false };
    }
  }

  async validateWallet(req) {
    const { settlementAddress } = req;
    if (!settlementAddress) throw Error(this.error.MISSING_SETTLEMENT_ADDRESS);

    // Validate settlementAddress
    // const { valid } = await this.validateAddress({ hash: settlementAddress });
    // if (!valid) throw Error(this.error.INVALID_SETTLEMENT_ADDRESS);

    // Check if settlementAddress already used
    const found = await this.wallets.findBySettlementAddress(this.name, settlementAddress);
    if (found) throw Error(this.error.ALREADY_HAS_WALLET);
  }


  async bundleWithdrawal(req, isColdWallet = true) {
    const { walletId, transactions } = req;

    if (!transactions || transactions.length === 0) {
      throw Error(this.error.MISSING_TRANSACTIONS);
    }

    const wallet = await this.wallets.find(walletId);
    console.log("wallet",wallet);
    if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);
    let sumWithDrawReq= 0;
    Promise.each(transactions ,async transaction => 
    {
      sumWithDrawReq += transaction.amount;
    })
    var settlementAddress = ""
    if (isColdWallet){
      settlementAddress = wallet.coldSettlementAddress
    } else {
      settlementAddress = wallet.settlementAddress
    }
    const balance =  await this.api.getBalance(settlementAddress);
    if( balance <sumWithDrawReq)
    throw  Error(this.error.NOT_ENOUGH_BALANCE);
    const payload = {
      type: this.bundleType.WITHDRAWAL,
      currency : this.currency,
      transactions: transactions,
      meta: await this.interpreter.getMeta(wallet,transactions,isColdWallet),
    };
    return { payload: JSON.stringify(payload) };
  }

  
  async broadcast(req) {
    // Read the payload
    const { payload  } = req;
    if (!payload) throw Error(this.error.MISSING_PAYLOAD);

    console.log("payload",payload);
    const { transactionsHash: txsHash } = JSON.parse(payload);
  
    const successTxsHash = [];
    await Promise.each(txsHash, async (txHash) => {
      const { hash, externals } = txHash;
      const transactionHash = await this.broadcastAndCreateWithdrawal(externals, hash);
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


  async broadcastAndCreateWithdrawal(externals, rawTransaction) {
    console.log('*---- BNB_Service.broadcastAndCreateWithdrawal ----*')
    const transaction = await this.interpreter.deserializeTx(rawTransaction);
    return this.db.transaction(async (trx) => {
      const { transactionHash } = transaction;
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
          response = await this.api.broadcast(rawTransaction);
        } catch (err) {
          response = null;
        }
        console.log('response:',response);
        const withdrawals = await this.interpreter.buildBroadcastedWithdrawals(transaction, response);
        // Create withdrawals from transaction
        return withdrawals[0].transactionHash;
      } catch (error) {
        this.debug(`Broadcast fail ${transactionHash} ${transaction} with error ${error}`);
        this.debug(error.stack);
        return null;
      }
    });
  }

  // Get balance of admin wallet
  // 
  async getTotalBalance (currency , walletId , isColdWallet = true)
  {
    let totalBalance = "";
    isColdWallet = (isColdWallet==='true');
    try {
      const wallet = await this.wallets.find(walletId);
      let address = '';
      if (isColdWallet)
      {
        address = wallet.coldSettlementAddress;
      } else {
        address = wallet.settlementAddress;
      }
      totalBalance =  await this.api.getBalance(address);
    }
    catch (err){
      console.log('BNB.getTotalBalance.err:',err);
      totalBalance = "0";
    }
    console.log('BNB.totalBalance:',totalBalance);
    return {currency, totalBalance}
  }

  // async getLastestBlock (currency )
  // { 
  //   const block  = await this.api.getLatestBlockHeight();
  //   return {currency ,block};
  // }
}
    


module.exports = BnbService;
