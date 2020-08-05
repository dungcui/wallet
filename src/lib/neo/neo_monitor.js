// const Decimal = require('decimal.js');
// const debug = require('debug')('wallet:btc_monitor');
const Promise = require('bluebird');
const Monitor = require('../monitor');
const constants = require('./neo_constants');
const { rangeToArray } = require('../../utils');
const { buildBalancesHash, buildConfirmNetworkTxs } = require('../../utils');

class NeoMonitor extends Monitor {
  constructor({
    neoSleepTime,
    neoStartBlockHeight,
    neoMinimumConfirmation,
    neoApi,
    db,
    block,
    token,
    neoInterpreter,
    funding,
    withdrawal,
    failedApi,
    address,
    neoNodeUrl,
    neoService
  }) {
    super({
      db,
      api: neoApi,
      name: constants.NAME,
      currency: constants.CURRENCY,
      block,
      token,
      interpreter: neoInterpreter,
      funding,
      withdrawal,
      failedApi,
      address,
      startBlockHeight: neoStartBlockHeight,
      minimumConfirmation: neoMinimumConfirmation,
      sleepTime: neoSleepTime,
      service: neoService
    });
    // For register currency mapping
    // this.web3 = new Web3();
    // this.web3.setProvider(new Web3.providers.HttpProvider(this.nodeUrl));
    this.nodeUrl = neoNodeUrl || 'http://95.217.42.58:10332';
    this.service = neoService;
  }

  async fetchRange(fromHeight, toHeight) {
    if (fromHeight > toHeight) return;
    const heights = rangeToArray(fromHeight, toHeight);
    await Promise.each(
      heights,
      async (height) => {
        if (!this.isRunning) return;
        
        //console.log("height is", height);
        let block = await this.getBlockInfo(height);
        //Rewrite block without "0x"
        // if(!block)
        // {
        //   await Promise.delay(4000 * this.sleepTime);
        //   block = await this.api.getBlock(height, 1);
        // }
        block.hash = block.hash.substring(2); 
        const txs = block.tx.filter(tx => ( tx.type === "ContractTransaction" || tx.type === "InvocationTransaction") );
        //console.log("txs", txs);
        let transactions = null;
        
        await Promise.each(txs, async(transaction) => {
          try {
            const parsedTx = await this.interpreter.parseTransaction(transaction, height);
            //console.log("parsedTx", parsedTx);
            if (transactions == null) {
              transactions = parsedTx;
            }
            else {
              transactions = transactions.concat(parsedTx);
            }
          } catch (error) {
            console.log("error there", error);
          }
        });
        
        transactions = transactions == null ? [] : transactions;
        const nextBlock = { hash: block.hash, height, transactions };
        this.nextBlocks.push(nextBlock);
      },
      { concurrency: 1 },
    );
  }
  
  async getBlockInfo(height) {
    const block =  await this.api.getBlock(height,1);
    if(block) {
      return block;
    } else { 
      console.log("ngu rui");
      await Promise.delay(100 * this.sleepTime);
      return this.getBlockInfo(height);
    }

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
    if(block)
    {
     // console.log("block",block);
      console.log("block.height",block.height);
      console.log("fromHeight",fromHeight);

    }
    return block && (block.height === fromHeight && block.height <= toHeight);
  }

  async autoMoveFunds(fundings) {
    try {
      console.log("reading fundings", fundings);
      let _fundings = [];
      let result = null;

      if (!Array.isArray(fundings)) {
        _fundings.push(fundings);
      }
      else {
        _fundings = fundings;
      }

      await Promise.each(_fundings,async(input, index) => {
        const walletId = input.toAddress.walletId;
        const address = input.toAddress.address;
        const amount = input.amount;
        const contractAddress = input.contractAddress;
        let smartContract = await this.service.getSmartContractCurrency(this.name, 
          contractAddress);
        const currency = (typeof smartContract === "undefined" ? this.name : smartContract.currency);
        

        let settlementAddress='';
        if (address === process.env.NEO_SETTLEMENT_ADDRESS) {
          return "";
        }        
        else {
          console.log("not a settlement address, preapre to movefund...");
          const req = {
            "currency": currency,
            "walletId": walletId,
            "address": address,
            "contractAddress": contractAddress,
            "transactions": [{
                "id": index,
                "address": process.env.NEO_SETTLEMENT_ADDRESS,
                "amount": amount,
                "currency" : currency,
            }]
          };

          let _result = await this.service.autoMoveFundsSmartContract(req);
          console.log("neo auto move fund result", _result);
          result += _result;
        }
      });

      return result;
    }
    catch (err) {
      throw new Error("Error on movefund..." + err);
    }
  }

  async processBlock({ height, hash, transactions }) {
    console.log("Neo processBlock...");
    //console.log("reading transaction", transactions);
    let req=null;
    await this.db.transaction(async (trx) => {
      this.debug(`Process block ${height}`);
      
      // Analyze fundings
      /// deposit
      const fundings = await this.buildFundings(transactions, trx);
      console.log('Neo fundings', fundings);
      const balancesHash = buildBalancesHash(fundings);

      // Analyze withdrawals
      const withdrawals = await this.buildWithdrawals(transactions, trx);
      const unknownWithdrawals = await this.buildUnknownWithdrawals(withdrawals, trx);
      const confirmedNetworkTxs = buildConfirmNetworkTxs(withdrawals);

      // Update database
      await Promise.each(unknownWithdrawals, tx => this.withdrawals.add(tx, trx));
      await Promise.each(withdrawals, tx => this.processWithdrawal(tx, trx));
      await Promise.each(withdrawals, tx =>
        this.withdrawals.markAsConfirmed(this.name, tx.transactionHash, trx));
      await Promise.each(fundings, async(tx) => {await this.fundings.add(tx, trx)});

      // Submit new block
      const block = { hash, height, balancesHash, confirmedNetworkTxs };
      await this.blocks.update(this.name, height, trx);
      // console.log(`tokenhash:${this.tokenHash}`);
    
      // Only emit if necessary
      if (balancesHash.length || confirmedNetworkTxs.length)
      {
        this.emit('block', block);
        req = fundings;
        
      }
    });
    if(req)
    {
        console.log("req",req);
        const movefund = await this.autoMoveFunds(req);
        console.log('checking movefund status:', movefund);
    }
  }

  async buildFundings(transactions, trx) {
    console.log("Neo buildFundings...");
    // Our filters
    const isFunding = transaction => transaction.toAddress;
    const isSupportedCurrency = (tx) => {
      const { service, currency, contractAddress } = tx;
      return (
        service === this.service.name || this.tokens.isEnabled(this.name, currency, contractAddress)
      );
    };

    const isNotExisted = async(tx) => {
      const { transactionHash, outputIndex } = tx;
      
      return !(await this.fundings.findFundingByTxHashAndOutputIndex(
        this.name,
        transactionHash,
        outputIndex,
        this.fundings.type.FUNDING,
        trx)
      );
    };
  
    const addFundingAttributes = tx => ({
      ...tx,
      addressId: tx.toAddress.id,
      service: this.name,
      type: this.fundings.type.FUNDING,
      state: this.fundings.state.CONFIRMED,
    });

    const fundingTransaction = await Promise.filter(transactions,
      async(tx) => {
        const notExisted = await isNotExisted(tx);
        //console.log("tx", tx);
        //console.log("isFunding(tx)", isFunding(tx) );
        //console.log("isSupportedCurrency(tx)", isSupportedCurrency(tx));
        //console.log("notExisted", notExisted);
        return isFunding(tx) && isSupportedCurrency(tx) && notExisted;
      },
      { concurrency: 1 },
    );

    return fundingTransaction.map(addFundingAttributes);
  }
}

module.exports = NeoMonitor;
