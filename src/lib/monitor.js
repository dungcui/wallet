const debug = require("debug");
const Promise = require("bluebird");
const Decimal = require("decimal.js");
const TinyQueue = require("tinyqueue");
const { EventEmitter } = require("events");
const { buildBalancesHash, buildConfirmNetworkTxs } = require("../utils");
const SignService = require("./signService.js");

class Monitor extends EventEmitter {
  constructor({
    db,
    api,
    name,
    block,
    token,
    wallet,
    interpreter,
    funding,
    withdrawal,
    failedApi,
    limit,
    moveFund,
    sleepTime,
    moveFundSleepTime,
    startBlockHeight,
    minimumConfirmation,
    address,
    currency
  }) {
    super();

    // States
    this.canStop = true;
    this.nextBlocks = [];
    this.isRunning = false;
    this.nextBlocks = new TinyQueue([], (a, b) => a.height - b.height);
    this.currency = currency;

    // Configs
    this.db = db;
    this.api = api;
    this.name = name;
    this.interpreter = interpreter;
    this.blocks = block;
    this.tokens = token;
    this.wallets = wallet;
    this.fundings = funding;
    this.failedApi = failedApi;
    this.limits = limit;
    this.moveFunds = moveFund;
    this.withdrawals = withdrawal;
    this.addresses = address;
    this.sleepTime = Number(sleepTime);
    this.moveFundSleepTime = Number(moveFundSleepTime);
    this.startBlockHeight = Number(startBlockHeight);
    this.minimumConfirmation = Number(minimumConfirmation);
    this.tokenHash = process.env.TOKEN_HASH;
    this.debug = debug(`wallet:monitor:${this.name}`);

    this.bundleType = {
      MOVE_FUND: "move_fund",
      WITHDRAWAL: "withdrawal"
    };
  }

  async start() {
    this.isRunning = true;
    this.canStop = false;
    await this.run();
    this.canStop = true;
  }

  async stop() {
    this.isRunning = false;
    this.debug("Attempt to stop...");
    if (this.canStop) {
      this.debug("Stopped.");
      return;
    }
    await Promise.delay(1000 * this.sleepTime);
    await this.stop();
  }

  async run() {
    while (this.isRunning) {
      await this.monitorNetwork();
      // await this.moveFundSchedule();
    }
  }

  validateBlock(block, fromHeight, toHeight) {
    return block && (block.height >= fromHeight && block.height <= toHeight);
  }

  async monitorNetwork() {
    console.log("*---- Monitor.monitorNetwork ----*");
    // const errApis=await this.failedApi.get(this.name);
    // console.log("err_apis",errApis);
    // await Promise.each(errApis , async (errApi) =>{
    //   this.emit('block', JSON.parse(errApi.body));
    //   console.log("errApi.service",errApi.service);
    //   console.log("errApi.service",errApi.id);
    //   this.failedApi.delete(errApi.service, errApi.id);
    // })

    // Get height from database
    const latestProcessedBlock = await this.blocks.get(this.name);

    // We set current height to height from db
    // Or from environment if db is blank
    const currentHeight = latestProcessedBlock
      ? latestProcessedBlock.height
      : this.startBlockHeight - 1;

    console.log("current height DB:", currentHeight);

    // Latest block from network
    const latestHeight = parseInt(await this.api.getLatestBlockHeight());
    console.log("latestHeight:", latestHeight);

    const confirmedHeight = latestHeight - this.minimumConfirmation;
    console.log("current height:", confirmedHeight);
    if (currentHeight < confirmedHeight) {
      // Fetch and process at the same time
      await Promise.all([
        this.fetchRange(currentHeight + 1, confirmedHeight),
        this.processRange(currentHeight + 1, confirmedHeight)
      ]);
    } else {
      // Reach confirmed height, nothing to do
      await Promise.delay(1000 * this.sleepTime);
    }
  }

  async shouldProcessNextBlock(fromHeight, toHeight) {
    console.log("*---- Monitor.shouldProcessNextBlock ----*");
    // Pre-validate
    if (!this.isRunning || fromHeight > toHeight) return false;

    // Validate next block
    const nextBlock = this.nextBlocks.peek();
    // console.log("nextBlock",nextBlock);
    // console.log("(this.validateBlock(nextBlock, fromHeight, toHeight)) ",(this.validateBlock(nextBlock, fromHeight, toHeight)) );

    if (this.validateBlock(nextBlock, fromHeight, toHeight)) return true;
    await Promise.delay(1000 * this.sleepTime);
    return this.shouldProcessNextBlock(fromHeight, toHeight);
  }

  async processRange(fromHeight, toHeight) {
    console.log("*---- Monitor.processRange ----*");
    // console.log("---> process range ",fromHeight , " to ",toHeight)
    // const a =(await this.shouldProcessNextBlock(fromHeight, toHeight))
    // console.log("need process ",this.nextBlocks);
    if (await this.shouldProcessNextBlock(fromHeight, toHeight)) {
      const nextBlock = this.nextBlocks.pop();
      await this.processBlock(nextBlock);
      await this.processRange(parseInt(nextBlock.height) + 1, toHeight);
    }
  }

  // async processBlock({ height, hash, transactions }) {
  // console.log("aaaa");
  async processBlock(nextBlock) {
    console.log("*---- Monitor.processBlock ----*");
    // console.log('nextBlock:',nextBlock)
    var { height, hash, transactions } = nextBlock;
    try {
      await this.db.transaction(async trx => {
        this.debug(`Process block ${height}`);
        // Analyze fundings

        /// deposit
        const fundings = await this.buildFundings(transactions, trx);
        // console.log('fundings:',fundings)
        const balancesHash = buildBalancesHash(fundings);

        // Analyze withdrawals
        const withdrawals = await this.buildWithdrawals(transactions, trx);
        const unknownWithdrawals = await this.buildUnknownWithdrawals(
          withdrawals,
          trx
        );
        const confirmedNetworkTxs = buildConfirmNetworkTxs(withdrawals);
        // console.log("withdrawals",withdrawals);
        // Update database
        await Promise.each(unknownWithdrawals, tx =>
          this.withdrawals.add(tx, trx)
        );
        await Promise.each(withdrawals, tx => this.processWithdrawal(tx, trx));
        await Promise.each(withdrawals, tx =>
          this.withdrawals.markAsConfirmed(this.name, tx.transactionHash, trx)
        );
        await Promise.each(fundings, async tx => {
          await this.fundings.add(tx, trx);
        });

        // Submit new block
        const block = { hash, height, balancesHash, confirmedNetworkTxs };
        await this.blocks.update(this.name, height, trx);
        console.log("block:", block);
        // console.log(`tokenhash:${this.tokenHash}`);

        // Only emit if necessary
        if (balancesHash.length || confirmedNetworkTxs.length) {
          console.log("Scan OK!!!!");
          this.emit("block", block);
          if (fundings && fundings.length) {
            const req = fundings;
            const movefund = await this.autoMoveFunds(req);
            console.log("movefund:", movefund);
          }
        }
      });
    } catch (err) {
      console.log("err", err);
    }
  }

  async autoMoveFunds(fundings) {
    console.log("*---- Monitor.autoMoveFunds ----*");
    // throw Error('Move fund not implemented');
  }

  async moveFundSchedule() {}
  async distributorGas() {
    console.log("*---- distributor Gas ----*");
  }

  async buildFundings(transactions, trx) {
    console.log("*----- Monitor.buildFundings -----*");
    // Our filters
    // console.log("transactions",transactions)
    const isFunding = transaction => transaction.toAddress;
    const isSupportedCurrency = tx => {
      const { currency, contractAddress } = tx;
      // console.log('*-- isSupportedCurrency --*')
      // console.log('currency:',currency)
      // console.log('this.currency:',this.currency)
      // console.log('this.name:',this.name)
      // console.log('contractAddress:',contractAddress)
      return (
        currency === this.currency ||
        this.tokens.isEnabled(this.name, currency, contractAddress)
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

  async buildUnknownWithdrawals(withdrawals, trx) {
    console.log("*----- Monitor.buildUnknownWithdrawals -----*");
    // Unknown filters
    const isUTXO = transaction =>
      transaction.inputs && transaction.inputs.length > 0;
    const isNotMoveFund = transaction =>
      (isUTXO(transaction) || transaction.fromAddress) && transaction.toAddress;

    const isUnknown = async ({ transactionHash, outputIndex }) =>
      !(await this.withdrawals.find(
        this.name,
        transactionHash,
        outputIndex,
        trx
      ));

    // Add attributes
    const addUnknownWithdrawalAttribute = tx => ({
      ...tx,
      externalId: null
    });

    const unknownWithdrawals = await Promise.filter(
      withdrawals,
      async transaction => {
        const unknown = await await isUnknown(transaction);
        return isNotMoveFund(transaction) && unknown;
      },
      { concurrency: 1 }
    );
    return unknownWithdrawals.map(addUnknownWithdrawalAttribute);
  }

  async buildWithdrawals(transactions, trx) {
    console.log("*----- Monitor.buildWithdrawals -----*");
    const isUTXO = transaction =>
      transaction.inputs && transaction.inputs.length > 0;
    const isWithdrawal = transaction => transaction.fromAddress;
    const isGoingToProcess = async ({ transactionHash, outputIndex }) => {
      const withdrawal = await this.withdrawals.find(
        this.name,
        transactionHash,
        outputIndex,
        trx
      );
      return !withdrawal || withdrawal.state === this.withdrawals.state.PENDING;
    };
    const addWithdrawalsAttribute = tx => ({
      ...tx,
      service: this.name,
      toAddress: tx.to
    });
    const withdrawals = (await Promise.filter(
      transactions,
      async tx => {
        const goingToProcess = await isGoingToProcess(tx);
        return (isUTXO(tx) || isWithdrawal(tx)) && goingToProcess;
      },
      { concurrency: 1 }
    )).map(addWithdrawalsAttribute);
    return withdrawals;
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
      // await this.spendVirtually(
      //   {
      //     ...withdrawal,
      //     amount: new Decimal(withdrawal.amount)
      //       .add(withdrawal.feeAmount)
      //       .toFixed()
      //   },
      //   trx
      // );
    } else {
      // Same as above but different fee currency, 2 spends
      console.log("withdrawal", withdrawal);
      console.log("withdrawalfee", {
        ...withdrawal,
        amount: withdrawal.feeAmount || 0,
        currency: withdrawal.feeCurrency || withdrawal.currency
      });

      await this.spendVirtually(withdrawal, trx);

      try {
        await this.spendVirtually(
          {
            ...withdrawal,
            amount: withdrawal.feeAmount || 0,
            currency: withdrawal.feeCurrency || withdrawal.currency
          },
          trx
        );
      } catch (error) {
        this.debug(error.stack);
      }
    }
  }

  async spend({ transactionHash, outputIndex, spentInTransactionHash }, trx) {
    this.fundings.markUTXOAsSpent(
      this.name,
      transactionHash,
      outputIndex,
      spentInTransactionHash,
      trx
    );
  }

  // Spend amount of currency from address, at hash
  async spendVirtually(
    { fromAddress, currency, amount, transactionHash, blockHeight },
    trx
  ) {
    console.log("*---- monitor.spendVirtually ----*");
    console.log("fromAddress.address :", fromAddress.address);
    console.log("currency: ", currency);
    console.log("ERC20: ", this.name);

    if (this.name == "ERC20" && currency == "ETHEREUM") {
      return;
    } else {
      const unspentFundings = await this.fundings.findAllUnspentByAddressAndCurrency(
        fromAddress.address,
        currency,
        trx
      );

      console.log("unspentFundings ", unspentFundings);
      const total = unspentFundings.reduce(
        (sum, tx) => sum.add(tx.amount),
        new Decimal(0)
      );
      console.log("total :", total.toString());
      console.log("amount :", amount.toString());

      const changeAmount = total.sub(amount);
      console.log("total :", changeAmount.toString());

      if (changeAmount.lt(0)) {
        throw Error("Not enough money to spend");
      }
      // No need to add 0 funding
      if (changeAmount.gt(0)) {
        const changeFunding = {
          currency,
          blockHeight,
          outputIndex: 0,
          transactionHash,
          service: this.name,
          addressId: fromAddress.id,
          amount: changeAmount.toFixed(),
          type: this.fundings.type.VIRTUAL,
          state: this.fundings.state.CONFIRMED
        };
        await this.fundings.add(changeFunding, trx);
      }
      await Promise.each(unspentFundings, tx =>
        this.fundings.markAsSpent(tx.id, transactionHash, trx)
      );
    }
  }
}

module.exports = Monitor;
