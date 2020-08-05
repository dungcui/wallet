// const Promise = require('bluebird');
// const _ = require('lodash');
const constants = require('./xrp_constants');
const Service = require('../service');
const Promise = require('bluebird');
const Decimal = require('decimal.js');
const utils = require('../../utils.js');

const XRP_TO_DROPS = 1000000;

class XrpService extends Service {
  constructor({
    db,
    block,
    token,
    wallet,
    address,
    funding,
    withdrawal,
    xrpRpc: api,
    xrpInterpreter: interpreter,
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
    this.fetchUnspentUrl = constants.FETCH_UNSPENT_URL;
  }

  async bundleMoveFund() {
    throw Error(this.error.MOVE_FUND_NOT_IMPLEMENTED);
  }

  async computeAvailableWithdrawals(wallet) {
    const balances = {};
    const { currency } = this;
    const { address: settlementAddress } = await this.addresses.findByPath(
      wallet.id,
      this.addresses.path.SETTLEMENT,
    );

    const accountInfo = await this.api.getAccountInfo(settlementAddress);
    balances[currency] = { amount: accountInfo.Balance };

    return balances;
  }

  async getMeta(wallet,transactions) {
  }

  /* eslint-disable class-methods-use-this */
  async ping() {
    const time = String(new Date().getTime());
    return { time };
  }

  async validateAddress(req) {
    const { hash } = req;
    const addressAndMemo= utils.splitAddressAndMemo(hash);
    if (!hash) throw Error(this.error.MISSING_ADDRESS);
    try {
      const result = await this.api.getAccountInfo(addressAndMemo.address);
      if(result) return { valid: true };
      else return { valid: false };
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
    this.debug("found" ,found);
    
    if (found) throw Error(this.error.ALREADY_HAS_WALLET);
    try {
      return await this.api.getAccountInfo(settlementAddress);
    } catch (err) {
      throw Error(this.error.INVALID_SETTLEMENT_ADDRESS);
    }
  }

  async broadcast(req) {
    const { payload } = req;
    if (!payload) throw Error(this.error.MISSING_PAYLOAD);

    const { transactionsHash: txsHash } = JSON.parse(payload);

    const successTxsHash = [];
    await Promise.each(txsHash, async (txHash) => {
      const { hash, externals } = txHash;
      const transactionHash = await this.broadcastAndCreateWithdrawal(externals, hash.hex, hash.txId);
      if (transactionHash) {
        externals.forEach((external) => {
          successTxsHash.push({
            externalId: external.id,
            transactionHash,
            outputIndex: external.index
          });
        });
      }
    });

    return { payload: JSON.stringify(successTxsHash) };
  }

  async broadcastAndCreateWithdrawal(externals, rawTransaction, txId) {
    const transaction = await this.interpreter.deserializeTx(rawTransaction, txId);
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
        const withdrawals = this.interpreter.buildBroadcastedWithdrawals(transaction);
        // Create withdrawals from transaction
        await Promise.each(withdrawals, async (withdrawal) => {
          if (!response) {
            return;
          }
          const extractExternals = externals.filter(external =>
            (external.index >= 0 && external.index === withdrawal.outputIndex) || !external.index);
          await Promise.each(extractExternals, async (extractExternal) => {
            this.withdrawals.add(
              {
                externalId: extractExternal.id || null,
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
        });
        return transactionHash || withdrawals[0].transactionHash;
      } catch (error) {
        this.debug(`Broadcast fail ${transactionHash} ${transaction} with error ${error}`);
        this.debug(error.stack);
        return null;
      }
    });
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
    var balance = 0;
    if (isColdWallet){
      balance = await this.api.getAccountInfo(wallet.coldSettlementAddress);
    }
    else {
      balance =  await this.api.getAccountInfo(wallet.settlementAddress);
    }
    console.log('balance:',balance);
    console.log("balance",balance.Balance);
    /// need 20 xrp  balane in wallet
    const avaiableWithdraw= new Decimal(balance.Balance).div(1000000).toFixed(2)-20;
    if( avaiableWithdraw <sumWithDrawReq)
    throw  Error(this.error.NOT_ENOUGH_BALANCE);
    const payload = {
      type: this.bundleType.WITHDRAWAL,
      transactions: transactions,
      meta: await this.interpreter.getMeta(wallet,transactions, isColdWallet),
    };
    return { payload: JSON.stringify(payload) };
  }

  // Get balance of admin wallet
  // 
  async getTotalBalance (currency , walletId, isColdWallet = true)
  {
    let totalBalance = "";
    isColdWallet = (isColdWallet==='true');
    let address = '';
    try {
      const wallet = await this.wallets.find(walletId);
      if(!isColdWallet)
      {
        address = wallet.settlementAddress;
      } else
      {
        address = wallet.coldSettlementAddress;
      }
      const accountInfo =  await this.api.getAccountInfo(address);
      totalBalance = new Decimal(accountInfo.Balance).div(1000000);
    }
    catch (err) {
      console.log('XRP.getTotalBalance.err:',err);
      totalBalance = "0";
    }
    console.log('XRP.totalBalance:',totalBalance);
    return {currency, totalBalance}
  }
}

module.exports = XrpService;
