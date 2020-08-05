const Decimal = require('decimal.js');
const Service = require('../service.js');
const constants = require('./eos_constants');
const Promise = require('bluebird');
const utils = require('../../utils.js');

class EosService extends Service {
  constructor({
    db,
    block,
    token,
    wallet,
    address,
    funding,
    withdrawal,
    eosApi: api,
    eosInterpreter: interpreter,
    EOS_TOKEN_ACCOUNT : eosTokenAccount,
    eosAccountName,

    
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
    this.eosTokenAccount= eosTokenAccount;
    this.eosAccountName= eosAccountName;

  }

  async validateAddress(req) {
    const { hash } = req;
    
    if (!hash) throw Error(this.error.MISSING_ADDRESS);
    const addressAndMemo= utils.splitAddressAndMemo(hash);
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
    // const unsignedTransactions = await this.capTransaction(transactions);
    let balance =0;
    if(!isColdWallet) {
      balance =  await this.api.getBalance(wallet.settlementAddress);
    } else 
    {
      balance =  await this.api.getBalance(wallet.coldSettlementAddress);
    }
    if( balance <sumWithDrawReq)
    throw  Error(this.error.NOT_ENOUGH_BALANCE);
    const payload = {
      type: this.bundleType.WITHDRAWAL,
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
    const { transactionsHash: txsHash , transactions } = JSON.parse(payload);
    try 
    {
      const successTxsHash = [];
      await Promise.each(txsHash, async (txHash,index) => {
        const { hash, externals } = txHash;
        const transactionHash = await this.broadcastAndCreateWithdrawal(externals, hash, transactions[index]);
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
      console.log('successTxsHash:',successTxsHash)
      return { payload: JSON.stringify(successTxsHash) };
    } catch(err)
    {
      console.log('EOS_broadcast.err:',err)
      return null;
    }
  }


  async broadcastAndCreateWithdrawal(externals, hash, requiredTransaction) {
    var result = [];
    for(var i in hash.serializedTransaction)
      result.push( hash.serializedTransaction [i]);

    const transaction = await this.interpreter.deserializeTx(result);
    console.log('broadcastAndCreateWithdrawal.transaction:',externals)
    return this.db.transaction(async (trx) => {
      const { transactionHash } = transaction;
      try {
        // Check duplicate
        try {
          await Promise.each(externals, async (external) => {
            await this.checkDuplicatedWithdrawal(external.id, transactionHash, trx);
          });
        } catch (err) {
          // this.debug(err.stack);
          throw Error(this.error.DUPLICATED_WITHDRAWAL); 
        }
        // broadcast transaction ...
        console.log('BROADCAST TRANSACTION')
        let response = null;
        try {
          const rawTransactionObj = 
          {
            signatures : hash.signatures,
            serializedTransaction : transaction
          }
          
          response = await this.api.broadcast(rawTransactionObj);
          // Create withdrawals from transaction
          const withdrawals = await this.interpreter.buildBroadcastedWithdrawals(requiredTransaction, response );
          console.log ('withdrawals:', withdrawals);
          await Promise.each(withdrawals, async (withdrawal) => {
            if (!response) {
              return;
            }
            this.withdrawals.add(
              {
                externalId: externals[0].id || null,
                service: this.name,
                amount: withdrawal.amount,
                currency: withdrawal.currency,
                toAddress: withdrawal.toAddress,
                outputIndex: withdrawal.outputIndex,
                state: this.withdrawals.state.PENDING,
                transactionHash: transactionHash || withdrawal.transactionHash,
              },
              trx,
            );
          });

        } catch (err) {
          response = null;
        }
        return response;
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
      if(!isColdWallet)
      {
        address = wallet.settlementAddress;
      } else {
        address = wallet.coldSettlementAddress;
      }
      totalBalance = await this.api.getBalance(address);
    }
    catch (err){
      console.log('EOS.getTotalBalance.err:',err);
      totalBalance = "0";
    }
    console.log('EOS.totalBalance:',totalBalance);
    return {currency, totalBalance}
  }

  // async getLastestBlock (currency )
  // { 
  //   const block  = await this.api.getLatestBlockHeight();
  //   return {currency ,block};
  // }
}
    


module.exports = EosService;
