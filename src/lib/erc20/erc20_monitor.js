const Promise = require("bluebird");
// const bitcoin = require('bitcoinjs-lib');
const Monitor = require("../monitor");
const Decimal = require("decimal.js");
// const debug = require('debug')('wallet:btc_monitor');
const constants = require("./erc20_constants");
const { buildBalancesHash, buildConfirmNetworkTxs } = require("../../utils");

const { rangeToArray } = require("../../utils");
const Web3 = require("web3");
const SignService = require("../signService.js");
const Service = require("./erc20_service");
const HdKey = require("ethereumjs-wallet/hdkey");
const EthereumTx = require("ethereumjs-tx");
const ERC20_NODE_URL = process.env.ERC20_NODE_URL;
const web3 = new Web3(new Web3.providers.WebsocketProvider(ERC20_NODE_URL)); // console.log("web3",web3);
// const connect = await web3.eth.net.isListening()
// console.log("connect",connect);
const erc20Api = require("./erc20_rpc");

// const BTC_TO_SATOSHI = 100000000;
// const BLOCK_REWARD_HALF_LIFE = 210000;
// const INIT_BLOCK_REWARD = 50 * BTC_TO_SATOSHI;

// BTC maximum is ~21000000 * 100000000 which below JS Number.MAX_SAFE_INTEGER

class Erc20Monitor extends Monitor {
  constructor({
    erc20SleepTime,
    erc20StartBlockHeight,
    erc20MinimumConfirmation,
    erc20Rpc,
    db,
    block,
    token,
    wallet,
    erc20Interpreter,
    funding,
    withdrawal,
    failedApi,
    limit,
    address,
    erc20NodeUrl,
    erc20PrivatekeyFeeAddress,
    erc20FeeAddress,
    erc20GasDistributor,
    erc20GasPrice,
    erc20GasLimit
  }) {
    super({
      db,
      api: new erc20Api(web3),
      name: constants.NAME,
      currency: constants.CURRENCY,
      block,
      token,
      wallet,
      interpreter: erc20Interpreter,
      funding,
      withdrawal,
      failedApi,
      limit,
      address,
      startBlockHeight: erc20StartBlockHeight,
      minimumConfirmation: erc20MinimumConfirmation,
      sleepTime: erc20SleepTime,
      erc20GasPrice,
      erc20GasLimit
    });
    // For register currency mapping
    // this.web3 = new Web3();
    // this.nodeUrl = erc20NodeUrl || 'http://95.216.227.169:8545';
    this.erc20PrivatekeyFeeAddress = erc20PrivatekeyFeeAddress;
    this.erc20FeeAddress = erc20FeeAddress;
    this.erc20GasDistributor = erc20GasDistributor;
    this.feeCurrency = constants.FEE_CURRENCY;
    this.gasPrice = Number(erc20GasPrice);
    this.gasLimit = Number(erc20GasLimit);
    this.web3 = web3;
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

  validateBlock(block, fromHeight, toHeight) {
    return block && (block.height === fromHeight && block.height <= toHeight);
  }

  async signTx(privateKey, toAddress, nonce, value, gas_price, gas_limit) {
    console.log("ETH_service.signTx ", value);
    let web3 = this.web3;
    const pk = Buffer.from(privateKey, "hex");
    const gasPrice = await web3.utils.toBN(
      web3.utils.toWei(web3.utils.toBN(gas_price), "gwei")
    );
    const gasLimit = await web3.utils.toBN(web3.utils.toBN(gas_limit));
    const amount = await web3.utils.toBN(web3.utils.toWei(`${value}`, "ether")); // default: ETH
    const txOptions = {
      nonce,
      gasLimit,
      gasPrice,
      to: toAddress,
      value: amount
    };
    const tx = new EthereumTx(txOptions);
    tx.sign(pk);
    return tx.serialize().toString("hex");
  }

  async getPath(hdPath) {
    const path = hdPath.indexOf("m") > -1 ? hdPath : `m/${hdPath}`;
    return path;
  }

  async distributorGas(req) {
    console.log("ERC2.0_monitor.autoMoveFunds");
    const { toAddress, grossAmount } = req;
    /// 0.002 is maximum gas fee
    const amount = new Decimal(grossAmount).toFixed();
    // const amount = grossAmount - this.baseFee;
    console.log("amount:", amount);
    const privateKey = this.erc20PrivatekeyFeeAddress;
    console.log("this.erc20FeeAddress", this.erc20FeeAddress);
    const nonce = await this.web3.eth.getTransactionCount(this.erc20FeeAddress);
    // console.log('this.baseFee:',this.baseFee);
    const hash = await this.signTx(
      privateKey,
      toAddress,
      nonce,
      amount,
      this.gasPrice,
      this.gasLimit
    );
    console.log("hash:", hash);
    try {
      const transactions = await this.api.broadcast(hash);
      console.log("transactions", transactions);
      const transactions_hash = transactions.transactions_hash;
      console.log("transactions_hash:", transactions_hash);
      return transactions_hash;
    } catch (err) {
      console.log("err", err);
    }
  }

  async processBlock({ height, hash, transactions }) {
    await this.db.transaction(async trx => {
      this.debug(`Process block ${height}`);
      // Analyze fundings

      /// deposit
      const fundings = await this.buildFundings(transactions, trx);
      const balancesHash = buildBalancesHash(fundings);

      // Analyze withdrawals
      const withdrawals = await this.buildWithdrawals(transactions, trx);
      const unknownWithdrawals = await this.buildUnknownWithdrawals(
        withdrawals,
        trx
      );
      const confirmedNetworkTxs = buildConfirmNetworkTxs(withdrawals);
      console.log("withdrawals", withdrawals);
      console.log("fundings", fundings);

      // Update database
      await Promise.each(unknownWithdrawals, tx =>
        this.withdrawals.add(tx, trx)
      );
      await Promise.each(withdrawals, tx => this.processWithdrawal(tx, trx));
      await Promise.each(withdrawals, tx =>
        this.withdrawals.markAsConfirmed(this.name, tx.transactionHash, trx)
      );
      await Promise.each(fundings, tx => this.fundings.add(tx, trx));

      // Submit new block
      const block = { hash, height, balancesHash, confirmedNetworkTxs };
      await this.blocks.update(this.name, height, trx);
      // console.log(`tokenhash:${this.tokenHash}`);

      // Only emit if necessary

      // ---- 2020-03-19: remove await movefunds from monitor----
      // this.distributeGasAndMoveFund(balancesHash, fundings);

      if (balancesHash.length || confirmedNetworkTxs.length) {
        this.emit("block", block);
      }
    });
  }

  async distributeGasAndMoveFund(balancesHash, fundings) {
    // ---- 2020-03-19: remove await movefunds from monitor----
    console.log("balancesHash", balancesHash);
    await Promise.each(balancesHash, async (blh, index) => {
      if (
        blh.currency !== "ETHEREUM" &&
        fundings[index].toAddress.type !== "settlement"
      ) {
        const balanceFee = new Decimal(
          await this.api.getBalanceEth(blh.address)
        ).div(Math.pow(10, 18));
        //"balances_hash":[{"currency":"USDC","address":"0x3e426A9036C8eCF8402ab19A7eeAb98e6cC04f15","transactionHash":"0x546c32ebfcc69e63dfd3ae6ce483f3f232ef6366d26a41354ec44d0908df5530","amount":"87.42"}]
        console.log("balanceFee", balanceFee.toFixed());
        if (balanceFee < this.erc20GasDistributor) {
          const req = {
            toAddress: blh.address,
            grossAmount: 0.003
          };
          // console.log('transaction:',req);
          try {
            const distributeGas = await this.distributorGas(req);
            console.log("distributeGas:", distributeGas);
          } catch (err) {
            console.log("distributeGas.err:", err);
          }
        }

        const req = fundings;
        const movefund = await this.autoMoveFunds(req);
        console.log("movefund:", movefund);
      }
    });
  }

  async buildFundings(transactions, trx) {
    // Our filters
    //console.log("transactions",transactions)
    const isFunding = transaction => transaction.toAddress;
    const isSupportedCurrency = tx => {
      const { currency, contractAddress } = tx;
      return (
        currency === this.currency ||
        this.tokens.isEnabled(this.name, currency, contractAddress) ||
        currency === this.feeCurrency
      );
    };
    const isNotExisted = async tx => {
      const { transactionHash, outputIndex } = tx;
      return !(await this.fundings.findFundingByTxHashAndOutputIndex(
        this.name,
        transactionHash,
        outputIndex,
        this.fundings.type.FUNDING,
        trx
      ));
    };

    const isHavingAmout = async tx => {
      const { amount } = tx;
      // console.log("aaaaaaaaaaaaaaaaaaaaaaaaaa",amount)
      return new Decimal(amount) > 0;
    };

    const addFundingAttributes = tx => ({
      ...tx,
      addressId: tx.toAddress.id,
      service: this.name,
      type: this.fundings.type.FUNDING,
      state: this.fundings.state.CONFIRMED
    });
    const fundingTransaction = await Promise.filter(
      transactions,
      async tx => {
        const notExisted = await isNotExisted(tx);
        // console.log("isFunding(tx) ",isFunding(tx) );
        // console.log("isSupportedCurrency(tx) ",isSupportedCurrency(tx) );;
        // console.log("notExisted" ,notExisted);
        return (
          isFunding(tx) &&
          isSupportedCurrency(tx) &&
          notExisted &&
          isHavingAmout(tx)
        );
      },
      { concurrency: 1 }
    );

    return fundingTransaction.map(addFundingAttributes);
  }

  async isSuccessTransaction(transaction) {
    const status = await this.api.getTransactionReceipt(transaction.hash);
    //  if(transaction.hash==="0xacf5f580e0b2d4ecbdd8cacae1ae4227c205add690844ee6ceeaa46478041679") console.log(status.status);
    if (status) return status.status;
  }

  async autoMoveFunds(fundings) {
    // console.log("fundings" ,fundings);
    const funding = fundings[0];
    const wallet = await this.wallets.find(funding.toAddress.walletId);
    if (
      funding.toAddress.address !== wallet.settlementAddress &&
      funding.toAddress.address !== wallet.coldSettlementAddress
    ) {
      const smartContract = await this.tokens.findContractByCurrencyAndService(
        this.name,
        funding.currency
      );
      const wallet = await this.wallets.find(funding.toAddress.walletId);
      const nonce = await this.web3.eth.getTransactionCount(
        funding.toAddress.address
      );
      // 90 % to cold wallet , 10 % to hot wallet
      // console.log("smartContract",smartContract);
      const transactions = [
        {
          id: funding.id,
          fromAddress: funding.toAddress.address,
          fromPath: funding.toAddress.path,
          toAddress: wallet.settlementAddress,
          grossAmount: funding.amount,
          nonce,
          gasPrice: this.gasPrice,
          gasLimit: this.gasLimit,
          currency: funding.currency,
          contract: smartContract.address,
          decimal: smartContract.decimals
        }
      ];
      // console.log("transactions",transactions);
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
        const body = { currency: this.currency, transactions: payload };
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

  async processWithdrawal(withdrawal, trx) {
    console.log("*----- Monitor.processWithdrawal -----*");
    if (withdrawal.inputs) {
      // This is for Bxx currencies
      await Promise.each(withdrawal.inputs, input =>
        this.spend(
          {
            ...input,
            spentInTransactionHash: withdrawal.transactionHash
          },
          trx
        )
      );
    } else if (withdrawal.currency === withdrawal.feeCurrency) {
      // This is for others, which need virtual fundings
      // Same fee currency, combine amount, 1 spend
      await this.spendVirtually(
        {
          ...withdrawal,
          amount: new Decimal(withdrawal.amount)
            // .add(withdrawal.feeAmount)
            .div(Math.pow(10, 9))
            .toFixed()
        },
        trx
      );
    } else {
      // Same as above but different fee currency, 2 spends
      // console.log("withdrawal",withdrawal);
      // console.log("withdrawalfee",new Decimal(withdrawal.feeAmount).div(Math.pow(10, 9)).toFixed());

      await this.spendVirtually(withdrawal, trx);

      try {
        await this.spendVirtually(
          {
            ...withdrawal,
            amount: new Decimal(withdrawal.feeAmount).div(Math.pow(10, 9)) || 0,
            currency: withdrawal.feeCurrency || withdrawal.currency
          },
          trx
        );
      } catch (error) {
        this.debug(error.stack);
      }
    }
  }
}

module.exports = Erc20Monitor;
