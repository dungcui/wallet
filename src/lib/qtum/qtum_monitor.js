
const Promise = require('bluebird');
const Monitor = require('../monitor');
const constants = require('./qtum_constants');
const { rangeToArray } = require('../../utils');

class QtumMonitor extends Monitor {
  constructor({
    qtumSleepTime, 
    qtumStartBlockHeight, 
    qtumMinimumConfirmation, 
    qtumRpc,
    db, 
    block, 
    token, 
    qtumInterpreter, 
    funding, 
    withdrawal, 
    failedApi,
    limit,
    address,
    qtumMaximumInput,
  }) {
    super({
      db,
      api: qtumRpc,
      name: constants.NAME,
      currency: constants.CURRENCY,
      block,
      token,
      interpreter: qtumInterpreter,
      funding,
      withdrawal,
      failedApi,
      limit,
      address,
      startBlockHeight: qtumStartBlockHeight,
      minimumConfirmation: qtumMinimumConfirmation,
      sleepTime: qtumSleepTime,
    });
    // For register currency mapping
    this.maximumInput = Number(qtumMaximumInput);
  }

  async fetchRange(fromHeight, toHeight) {
    if (fromHeight > toHeight) return;
    const heights = rangeToArray(fromHeight, toHeight);
    await Promise.each(heights, async (height) => {
      if (!this.isRunning) return;
      const blockHash = await this.api.getBlockHashByHeight(height);
      const block = await this.api.getBlock(blockHash);
      const transactions = [];
      await Promise.each(block.tx, async (transaction) => {
        let transactionRaw = null;
        try {
          transactionRaw = await this.api.getRawTx(transaction);
          const parsedTx = await this.interpreter.parseTransaction(transactionRaw, height);
          transactions.push(...parsedTx);
        } catch (error) {
          transactionRaw = null;
        }
      });
      const nextBlock = { hash: block.hash, height, transactions };
      this.nextBlocks.push(nextBlock);
    }, { concurrency: 1 });
  }

  validateBlock(block, fromHeight, toHeight) {
    return block && (
      block.height === fromHeight &&
      block.height <= toHeight
    );
  }

  async moveFundSchedule()
  {
    // transfer from hot wallet;
    let isColdWallet = false;
    let btcLimits = await this.limits.getByService(constants.NAME);
    let wallet = await this.wallets.find(btcLimits.walletId);
    const amount = await (this.fundings
      .sumUnspentAmountByWalletIdAndCurrencyWithTypeWallet(wallet.id, constants.NAME, isColdWallet));
    const BTC_TO_SATOSHI = constants.BTC_TO_SATOSHI;
    // const BTC_TO_SATOSHI = 1;

    let amoutForTransfer = new Decimal(amount - btcLimits.limits*BTC_TO_SATOSHI - this.btcMaximumFee);
   
    let transactions =[];
    if(amoutForTransfer >0)
    {
      transactions.push({id:-99999102,amount:amoutForTransfer,address: wallet.coldSettlementAddress,currency:"BTC"});
      
      let unspentTxOuts = await this.fundings.findTopUnspentByWalletIdAndCurrencyWithTypeWallets(
        wallet.id,
        this.currency,
        this.maximumInput,
        isColdWallet
      );
      console.log("unspentTxOuts",unspentTxOuts);

      const inputs = await Promise.map(unspentTxOuts, async (t) => {
        const address = await this.addresses.find(t.addressId);
        return {
          script: t.script,
          transactionHash: t.transactionHash,
          outputIndex: t.outputIndex,
          amount: new Decimal(t.amount).round().toFixed(),
          hdPath: address.path,
        };
      });

      const outputs = transactions.map((t) => {
        t.amount = t.amount.toFixed();
        return t;
      });
      const result = {
        successTransactions: transactions.map(t => t.id),
        inputs,
        outputs,
      };

      const payload = {
        type: this.bundleType.WITHDRAWAL,
        transactions: transactions,
        meta: result ,
      };

      const Signer =  new SignService();
      console.log("Signer",Signer);
      try {
        const body = { currency : this.currency, transactions : payload }
        console.log("body",JSON.stringify(body));
  
        const signedHash=(await Signer.getSignedHashs(JSON.stringify(body)));
        console.log("signedHash",signedHash);
        // const bodyResult = JSON.parse(signedHash);
        if(signedHash.status ==='Success')
        {
          const payloadBroadcast  = { currency : signedHash.output.currency , payload : JSON.stringify(signedHash.output)  }
          console.log("payloadBroadcast",payloadBroadcast);
          // return this.broadcast(payloadBroadcast);
        }
  
      }catch (er)
      {
        console.log("err",er);
      }
      
    
    }
    // Reach confirmed height, nothing to do
    await Promise.delay(1000 * this.moveFundSleepTime);
  
  }
}

module.exports = QtumMonitor;
