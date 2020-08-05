
const Promise = require('bluebird');
// const bitcoin = require('bitcoinjs-lib');
const Monitor = require('../monitor');
// const Decimal = require('decimal.js');
// const debug = require('debug')('wallet:btc_monitor');
const constants = require('./dash_constants');
const { rangeToArray } = require('../../utils');
const Decimal = require('decimal.js');

// const BTC_TO_SATOSHI = 100000000;
// const BLOCK_REWARD_HALF_LIFE = 210000;
// const INIT_BLOCK_REWARD = 50 * BTC_TO_SATOSHI;

// BTC maximum is ~21000000 * 100000000 which below JS Number.MAX_SAFE_INTEGER

class DashMonitor extends Monitor {
  constructor({
    dashSleepTime, dashStartBlockHeight, dashMinimumConfirmation, dashRpc,
    db, block, token,wallet, dashInterpreter, funding, withdrawal,failedApi, limit, address,
    dashMaximumInput,
  }) {
    super({
      db,
      api: dashRpc,
      name: constants.NAME,
      currency: constants.CURRENCY,
      block,
      token,
      wallet,
      interpreter: dashInterpreter,
      funding,
      withdrawal,
      failedApi,
      limit,
      address,
      startBlockHeight: dashStartBlockHeight,
      minimumConfirmation: dashMinimumConfirmation,
      sleepTime: dashSleepTime,
    });
    // For register currency mapping
    this.maximumInput = Number(dashMaximumInput);
  }

  // async run() {
  //   if (!this.isRunning) {
  //     return;
  //   }

  // Compute height is new height to process
  //   const currentBlock = await this.blocks.getLatest();
  //   const height = currentBlock ? currentBlock.height + 1 : this.startBlockHeight;
  //   if (!Number.isInteger(height)) throw Error('Cannot determine block height');

  //   // Compute confirmedHeight
  //   const latestHeight = await this.rpc.getLatestBlockHeight();
  //   const confirmedHeight = latestHeight - this.minimumConfirmation;

  //   // Fast deposit
  //   await this.processBlock(latestHeight, true);

  //   // Normal deposit
  //   // If block with this height has not been confirmed yet
  //   if (confirmedHeight < height) {
  //     // Do nothing, wait for new block
  //     await Promise.delay(1000 * this.sleepTime);
  //   } else {
  //     await this.processBlock(height, false);
  //   }

  //   // Do another loop
  //   await this.run();
  // }

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

  // async processBlock(height, isFastForward = false) {
  //   await this.db.transaction(async (trx) => {
  //     debug(`Process block #${height}`);
  //     const hash = await this.rpc.getBlockHashByHeight(height);
  //     const data = await this.rpc.getBlock(hash, true);
  //     const block = bitcoin.Block.fromHex(data);

  //     const [balancesHash, unspentTxOuts] = await this.buildBalancesHashAndTxOuts(
  //       block,
  //       isFastForward,
  //       trx,
  //     );

  //     // Add pending txout from balance hash
  //     await Promise.each(unspentTxOuts, async (out) => {
  //       debug(`Add output ${out.txHash} index ${out.index}`);
  //       await this.txOuts.add(
  //         height, out.txHash, out.index,
  //         out.value, out.address, out.script,
  //         trx,
  //       );
  //     });

  //     // Look for confmation network transactions
  //     const confirmedNetworkTxs = await this.confirmedNetworkTransactions(block, height, trx);

  //     if (!isFastForward) {
  //       // Only process if not fast forward process
  //       await this.markAsSpent(block, height, trx);
  //       const fee = this.constructor.calculateNetworkFee(block, height, trx);
  //       await this.blocks.add(hash, height, fee, trx);
  //     }

  //     // If nothing new in fast deposit
  //     if (confirmedNetworkTxs.length === 0
  //       && Object.keys(balancesHash).length === 0
  //       && isFastForward) {
  //       return;
  //     }
  //     // Emit `block` event with height, hash and balance hash if there are something new
  //     this.emit('block', {
  //       height,
  //       hash,
  //       balancesHash: {
  //         [this.currencies[0]]: balancesHash,
  //       },
  //       confirmedNetworkTxs: {
  //         [this.currencies[0]]: confirmedNetworkTxs,
  //       },
  //       isFastForward,
  //     });
  //   });
  // }

  // async confirmedNetworkTransactions(block, height, trx) {
  //   const confirmedNetworkTxs = [];
  //   const awaitingNetworkTxs = (await this.bundle.getAwaiting(trx)).map(b => b.txHash);
  //   await Promise.each(block.transactions, async (t) => {
  //     const txHash = t.getId();
  //     if (awaitingNetworkTxs.indexOf(txHash) >= 0) {
  //       // Found, confirm it
  //       await this.bundle.markAsConfirmed(txHash, height, trx);
  //       confirmedNetworkTxs.push(txHash);
  //     }
  //   });
  //   return confirmedNetworkTxs;
  // }

  // async buildBalancesHashAndTxOuts(block, isFastForward, trx) {
  //   const balancesHash = {};
  //   const txOuts = [];
  //   await Promise.each(block.transactions, async (t) => {
  //     // Hash in reverse bit order
  //     const txHash = t.getId();
  //     await Promise.each(t.outs, async (o, index) => {
  //       let address;
  //       try {
  //         address = bitcoin.address.fromOutputScript(o.script);
  //       } catch (e) { } // eslint-disable-line no-empty
  //       if (address) {
  //         // Check if address exist
  //         const found = await this.addresses.findByHash(address, trx);
  //         if (found) {
  //           // TODO: Fast deposit
  //           if (isFastForward) {
  //             return;
  //           }
  //           // Check if txout has fast deposit, make sure don't duplicate it
  //           const txOut = await this.txOuts.find(txHash, index, trx);
  //           if (txOut) {
  //             return;
  //           }
  //           txOuts.push({
  //             txHash,
  //             index,
  //             address,
  //             value: o.value,
  //             script: o.script.toString('hex'),
  //           });
  //           // Check if address is change address => exclude from balances hash
  //           if (found.type === this.addresses.TYPE.CHANGE) {
  //             return;
  //           }
  //           if (!balancesHash[address]) {
  //             balancesHash[address] = {};
  //           }
  //           if (!balancesHash[address][txHash]) {
  //             balancesHash[address][txHash] = '0';
  //           }
  //           // Convert from satoshi to BTC
  //           balancesHash[address][txHash] = new Decimal(balancesHash[address][txHash])
  //             .add(new Decimal(o.value).div(BTC_TO_SATOSHI))
  //             .toString();
  //         }
  //       }
  //     });
  //   });
  //   return [balancesHash, txOuts];
  // }

  // async markAsSpent(block, height, trx) {
  //   await Promise.each(block.transactions, async (t) => {
  //     // Skip coinbase
  //     if (!t.isCoinbase()) {
  //       // Hash in reverse bit order
  //       const txHash = t.getId();
  //       await Promise.each(t.ins, async (inp) => {
  //         const txInpHash = inp.hash.reverse().toString('hex');
  //         const { index } = inp;
  //         // Find if tx hash in db
  //         const txOut = await this.txOuts.find(txInpHash, index, trx);
  //         if (txOut) {
  //           // Check if it spent
  //           if (txOut.status === this.txOuts.STATUS.SPENT) {
  //             throw Error(`Unspent output ${txInpHash} index ${index} is already spent`);
  //           }
  //           // Mark as spent
  //           debug(`Mark output ${txInpHash} index ${index} as spent`);
  //           await this.txOuts.markAsSpent(txInpHash, index, txHash, trx, height);
  //         }
  //       });
  //     }
  //   });
  // }

  // static calculateNetworkFee(block, height) {
  //   // Get coinbase transaction
  //   const coinbase = block.transactions.find(t => t.isCoinbase());
  //   if (!coinbase) {
  //     throw Error('Coinbase transaction not found');
  //   }
  //   const reward = BtcMonitor.getBlockReward(height);
  //   const total = coinbase.outs.reduce((acc, txOut) => acc.add(txOut.value), new Decimal(0));
  //   const fee = total.sub(reward);
  //   // Calculate transactions size (exclude coinbase)
  //   const size = block.transactions.reduce((acc, t) => {
  //     if (!t.isCoinbase()) {
  //       return acc + t.byteLength();
  //     }
  //     return acc;
  //   }, 0);
  //   if (size === 0) {
  //     return 0;
  //   }
  //   return fee.div(size).floor().toNumber();
  // }

  // static getBlockReward(height) {
  //   const numberOfHalfLivesElapsed = Math.floor(height / BLOCK_REWARD_HALF_LIFE);
  //   return new Decimal(INIT_BLOCK_REWARD).div(new Decimal(2).pow(numberOfHalfLivesElapsed)).floor();
  // }

  validateBlock(block, fromHeight, toHeight) {
    return block && (
      block.height === fromHeight &&
      block.height <= toHeight
    );
  }

  async moveFundSchedule()
  {
    // transfer from hot wallet;
  //   let isColdWallet = false;
  //   let btcLimits = await this.limits.getByService(constants.NAME);
  //   let wallet = await this.wallets.find(btcLimits.walletId);
  //   const amount = await (this.fundings
  //     .sumUnspentAmountByWalletIdAndCurrencyWithTypeWallet(wallet.id, constants.NAME, isColdWallet));
  //   const BTC_TO_SATOSHI = constants.BTC_TO_SATOSHI;
  //   // const BTC_TO_SATOSHI = 1;

  //   let amoutForTransfer = new Decimal(amount - btcLimits.limits*BTC_TO_SATOSHI - this.btcMaximumFee);
   
  //   let transactions =[];
  //   if(amoutForTransfer >0)
  //   {
  //     transactions.push({id:-99999102,amount:amoutForTransfer,address: wallet.coldSettlementAddress,currency:"BTC"});
      
  //     let unspentTxOuts = await this.fundings.findTopUnspentByWalletIdAndCurrencyWithTypeWallets(
  //       wallet.id,
  //       this.currency,
  //       this.maximumInput,
  //       isColdWallet
  //     );
  //     console.log("unspentTxOuts",unspentTxOuts);

  //     const inputs = await Promise.map(unspentTxOuts, async (t) => {
  //       const address = await this.addresses.find(t.addressId);
  //       return {
  //         script: t.script,
  //         transactionHash: t.transactionHash,
  //         outputIndex: t.outputIndex,
  //         amount: new Decimal(t.amount).round().toFixed(),
  //         hdPath: address.path,
  //       };
  //     });

  //     const outputs = transactions.map((t) => {
  //       t.amount = t.amount.toFixed();
  //       return t;
  //     });
  //     const result = {
  //       successTransactions: transactions.map(t => t.id),
  //       inputs,
  //       outputs,
  //     };

  //     const payload = {
  //       type: this.bundleType.WITHDRAWAL,
  //       transactions: transactions,
  //       meta: result ,
  //     };

  //     const Signer =  new SignService();
  //     console.log("Signer",Signer);
  //     try {
  //       const body = { currency : this.currency, transactions : payload }
  //       console.log("body",JSON.stringify(body));
  
  //       const signedHash=(await Signer.getSignedHashs(JSON.stringify(body)));
  //       console.log("signedHash",signedHash);
  //       // const bodyResult = JSON.parse(signedHash);
  //       if(signedHash.status ==='Success')
  //       {
  //         const payloadBroadcast  = { currency : signedHash.output.currency , payload : JSON.stringify(signedHash.output)  }
  //         console.log("payloadBroadcast",payloadBroadcast);
  //         // return this.broadcast(payloadBroadcast);
  //       }
  
  //     }catch (er)
  //     {
  //       console.log("err",er);
  //     }
      
    
  //   }
  //   // Reach confirmed height, nothing to do
  //   await Promise.delay(1000 * this.moveFundSleepTime);
  
  }
}

module.exports = DashMonitor;
