const Promise = require("bluebird");
// const bitcoin = require('bitcoinjs-lib');
const Monitor = require("../monitor");
// const Decimal = require('decimal.js');
// const debug = require('debug')('wallet:btc_monitor');
const constants = require("./etc_constants");
const { rangeToArray } = require("../../utils");
const SignService = require("../signService.js");
const Web3 = require("web3");
const ethApi = require("./etc_api");
const ETC_NODE_URL = process.env.ETC_NODE_URL;
// console.log("ETH_NODE_URL", ETC_NODE_URL);
const web3 = new Web3(new Web3.providers.WebsocketProvider(ETC_NODE_URL));

// const Web3 = require('web3');

// const BTC_TO_SATOSHI = 100000000;
// const BLOCK_REWARD_HALF_LIFE = 210000;
// const INIT_BLOCK_REWARD = 50 * BTC_TO_SATOSHI;

// BTC maximum is ~21000000 * 100000000 which below JS Number.MAX_SAFE_INTEGER

class EtcMonitor extends Monitor {
  constructor({
    etcSleepTime,
    etcStartBlockHeight,
    etcMinimumConfirmation,
    etcApi,
    db,
    block,
    token,
    wallet,
    etcInterpreter,
    funding,
    withdrawal,
    failedApi,
    limit,
    address,
    etcNodeUrl,
    etcGasPrice,
    etcGasLimit
  }) {
    super({
      db,
      api: new ethApi(web3),
      name: constants.NAME,
      currency: constants.CURRENCY,
      block,
      token,
      wallet: wallet,
      interpreter: etcInterpreter,
      funding,
      withdrawal,
      failedApi,
      limit,
      address,
      startBlockHeight: etcStartBlockHeight,
      minimumConfirmation: etcMinimumConfirmation,
      sleepTime: etcSleepTime
    });
    // For register currency mapping
    // this.web3 = new Web3();
    this.gasPrice = Number(etcGasPrice);
    this.gasLimit = Number(etcGasLimit);
    this.nodeUrl = etcNodeUrl || "http://95.216.227.169:8545";
    // this.web3.setProvider(new Web3.providers.HttpProvider(this.nodeUrl));
    this.web3 = web3;
    // this.web3.setProvider(new Web3.providers.HttpProvider(this.nodeUrl));
  }
  async fetchRange(fromHeight, toHeight) {
    if (fromHeight > toHeight) return;
    const heights = rangeToArray(fromHeight, toHeight);
    await Promise.each(
      heights,
      async height => {
        if (!this.isRunning) return;
        const block = await this.api.getBlockHashByHeight(height, true);
        // const blockHash = await this.api.getBlockHashByHeight(height);
        // const block = await this.api.getBlock(blockHash);
        const transactions = [];
        const filtedTransactions = Promise.filter(
          block.transactions,
          async tx => {
            return await this.isSuccessTransaction(tx);
          }
        );
        await Promise.each(filtedTransactions, async transaction => {
          try {
            const parsedTx = await this.interpreter.parseTransaction(
              transaction,
              height
            );
            transactions.push(parsedTx);
          } catch (error) {
            console.log(error);
          }
        });
        const nextBlock = { hash: block.hash, height, transactions };
        this.nextBlocks.push(nextBlock);
      },
      { concurrency: 1 }
    );
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

  async isSuccessTransaction(transaction) {
    const status = await this.api.getTransactionReceipt(transaction.hash);
    //  if(transaction.hash==="0xacf5f580e0b2d4ecbdd8cacae1ae4227c205add690844ee6ceeaa46478041679") console.log(status.status);
    if (status) return status.status;
  }

  validateBlock(block, fromHeight, toHeight) {
    return block && (block.height === fromHeight && block.height <= toHeight);
  }

  async autoMoveFunds(fundings) {
    //console.log("fundings" ,fundings);
    // const transactions = await Promise.map(fundings, async (funding) => {
    // const fromAddress = funding.from;
    // const { address } = fromAddress;
    const funding = fundings[0];
    const wallet = await this.wallets.find(funding.toAddress.walletId);
    if (
      funding.toAddress.address !== wallet.settlementAddress &&
      funding.toAddress.address !== wallet.coldSettlementAddress
    ) {
      const nonce = await this.web3.eth.getTransactionCount(
        funding.toAddress.address
      );
      // 90 % to cold wallet , 10 % to hot wallet
      const transactions = [
        {
          id: funding.id,
          fromAddress: funding.toAddress.address,
          fromPath: funding.toAddress.path,
          toAddress: wallet.settlementAddress,
          grossAmount: new Decimal(
            funding.amount - Math.round(this.gasPrice * this.gasLimit)
          )
            .div(1000000000)
            .toFixed(),
          nonce,
          gasPrice: this.gasPrice,
          gasLimit: this.gasLimit,
          currency: this.CURRENCY
          // },{
          //   id: funding.id,
          //   fromAddress: funding.toAddress.address,
          //   fromPath : funding.toAddress.path,
          //   toAddress: wallet.coldSettlementAddress,
          //   grossAmount: new Decimal(funding.amount - Math.round(this.gasPrice*this.gasLimit)).mul(10).div(100).div(1000000000).toFixed(),
          //   nonce,
          //   gasPrice: this.gasPrice,
          //   gasLimit: this.gasLimit,
          //   currency,
          // },
        }
      ];
      // });

      console.log("transactions", transactions);

      const payload = {
        type: this.bundleType.MOVE_FUND,
        transactions,
        meta: await this.interpreter.getMeta(wallet)
      };

      // const option = { deep: true };
      // const payload =  { payload: JSON.stringify(snakeCaseKeys(payload, option)) };
      const Signer = new SignService();
      console.log("Signer", Signer);
      try {
        const body = { currency: "ETH", transactions: payload };
        console.log("body", JSON.stringify(body));

        const signedHash = await Signer.getSignedHashs(JSON.stringify(body));
        console.log("signedHash", signedHash);
        // const bodyResult = JSON.parse(signedHash);
        if (signedHash.status === "Success") {
          const result = await Promise.map(
            signedHash.output.transactionsHash,
            async transaction_hash => {
              console.log("transaction_hash", transaction_hash);
              return await this.api.broadcast(transaction_hash.hash);
            }
          );
          return result;
        }
      } catch (err) {
        console.log("err", err);
      }
    }
  }
}

module.exports = EtcMonitor;
