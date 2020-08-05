const Decimal = require('decimal.js');
const Promise = require('bluebird');
const debug = require('debug')('wallet:tron_monitor');
const Monitor = require('../monitor');
const TinyQueue = require('tinyqueue');
const SignService = require('../signService.js');


class TronMonitor extends Monitor {
  constructor({
    db,
    tronWallet,
    tronApi,
    tronRpc,
    tronBlock,
    tronParser,
    tronSleepTime,
    tronTransaction,
    tronStartBlockHeight,
    tronMinimumConfirmations,
    failedApi,
    limit,
  }) {
    super({
      db,
    });
    this.currencies = ['TRX'];
    this.heightPassing = true;
    this.blocksQueue = new TinyQueue([], (a, b) => a.height - b.height);

    this.minimumConfirmations = Number(tronMinimumConfirmations);
    this.startBlockHeight = Number(tronStartBlockHeight);
    this.sleepTime = Number(tronSleepTime);
    this.transactions = tronTransaction;
    this.blocks = tronBlock;
    this.parser = tronParser;
    this.api = tronApi;
    this.rpc = tronRpc;
    this.db = db;
    this.tokenHash = process.env.TOKEN_HASH;
    this.wallets= tronWallet;
    this.failedApi=failedApi;
    this.limit = limit;
  }

  async run() {
    if (!this.isRunning) return;
    await this.monitorNetwork();
    await this.run();
  }

  async monitorNetwork() {

    // const errApis=await this.failedApi.get(this.name);
    // console.log("err_apis",errApis);
    // await Promise.each(errApis , async (errApi) =>{
    //   this.emit('block', JSON.parse(errApi.body));
    //   this.failedApi.delete(errApi.service, errApi.id);
    // })
    const latestBlock = this.parser.parseBlock(await this.rpc.getLatestBlock());
    //console.log("latestBlock",latestBlock.height);
    const confirmedHeight = latestBlock.height - this.minimumConfirmations;
    //const confirmedHeight = 	9871471
    const latestProcessedBlock = await this.blocks.getLatest();
    const currentHeight = latestProcessedBlock
      ? latestProcessedBlock.height
      : this.startBlockHeight - 1;
    console.log("currentHeight",currentHeight);

    if (currentHeight < confirmedHeight) {
      await Promise.all([
        this.processRange(currentHeight + 1, confirmedHeight),
        this.fetchBlocks(currentHeight + 1, confirmedHeight),
      ]);
    } else {
      await Promise.delay(1000 * this.sleepTime);
    }
  }

  async fetchBlock(height) {
    const raw = await this.rpc.getBlock(height);
    // console.log("raw",raw);
    const block = this.parser.parseBlock(raw);
    this.blocksQueue.push(block);
  }

  async fetchBlocks(fromHeight, toHeight) {
    if (!this.isRunning || fromHeight > toHeight) return;
    await Promise.delay((this.heightPassing ? 0 : 1000) + this.blocksQueue.length);
    await Promise.all([
      this.fetchBlock(fromHeight),
      this.fetchBlocks(fromHeight + 1, toHeight),
    ]);
  }

  validateBlock(block, fromHeight, toHeight) {
    if (!block) return false;
    this.heightPassing = (
      block.height === fromHeight &&
      block.height <= toHeight
    );
    return this.heightPassing;
  }

  async processRange(fromHeight, toHeight) {
    if (!this.isRunning || fromHeight > toHeight) return;
    const block = this.blocksQueue.peek();
    if (this.validateBlock(block, fromHeight, toHeight)) {
      this.blocksQueue.pop();
      await this.processBlock(block);
      await this.processRange(block.height + 1, toHeight);
    } else {
      await Promise.delay(1000 * this.sleepTime);
      await this.processRange(fromHeight, toHeight);
    }
  }

  async buildBalancesHash(fundingTxs) {
    const balancesHash = {};
    const deposits = [];
    fundingTxs.forEach((fundingTx) => {
      const amount = new Decimal(fundingTx.amount).div(this.parser.ONE_TRX);
      balancesHash[fundingTx.to] = balancesHash[fundingTx.to] || {};
      balancesHash[fundingTx.to][fundingTx.hash] =
        new Decimal(balancesHash[fundingTx.to][fundingTx.hash] || 0)
          .add(amount)
          .toFixed();

          deposits.push({currency :this.currencies[0] ,address : fundingTx.to, transactionHash: fundingTx.hash,amount: amount})

    });
    if(deposits.length==0) return ; 
    return deposits;
  }

  async saveFundingTransaction(tx, blockHeight, trx) {
    return this.transactions.add({
      blockHeight,
      hash: tx.hash,
      toAddress: tx.to,
      fromAddress: tx.from,
      toPath: tx.toAddress.path,
      walletId: tx.toAddress.walletId,
      type: this.transactions.type.FUNDING,
      state: this.transactions.state.CONFIRMED,
      grossAmount: new Decimal(tx.amount).toFixed(),
    }, trx);
  }

  async processBlock(block) {
    const { transactions: blockTxs, hash, height } = block;
    debug(`Process block ${height}`);

    await this.db.transaction(async (trx) => {
      // Already processed
      if (await this.blocks.findByHeight(height, trx)) return;

      const confirmedTxs =
        (await this.transactions.confirm(blockTxs, trx)).map(tx => tx.hash);

      const fundingTxs = (await Promise.map(
        blockTxs,
        tx => this.parser.fetchAddress(tx, trx),
        { concurrency: 1 },
      )).filter(tx => this.parser.isUserFundingTransaction(tx));
      if(height==13421481)
      {
        console.log("blockTxs",blockTxs);
      }

      await this.blocks.add({ hash, height }, trx);
      if (!(confirmedTxs.length || fundingTxs.length)) return;

      // Save funding txs
      await Promise.each(fundingTxs, tx => this.saveFundingTransaction(tx, height, trx));

      // Emit block to mq
      const confirmedNetworkTxs =  confirmedTxs ;
      const balancesHash = await this.buildBalancesHash(fundingTxs, trx);
      // const wallet = await this.wallets.load({id :fundings[0].toAddress.walletId})
    
     
      if(balancesHash.length || confirmedNetworkTxs.length)
      {
        this.emit('block', { height, hash, balancesHash, confirmedNetworkTxs });
        console.log("balancesHash",fundingTxs);
        if(balancesHash.length)
        {
          await this.autoMoveFunds(fundingTxs)
        }
      }
    });
  }

  async autoMoveFunds(fundings) {
      console.log("fundings",fundings);
      const wallet = await this.wallets.load({id :fundings[0].toAddress.walletId})
      console.log("wallets",wallet);
      if(wallet.settlementAddress!==fundings[0].to)
      {
        const transactions = fundings.map(funding => ({
          id: -1,
          moveFundForId: funding.hash,
          fromPath: funding.toAddress.path,
          toAddress: wallet.settlementAddress,
          //// need 0.1 trx for fee
          amount: new Decimal(funding.amount).toString(),
        }));

        const type = this.transactions.type.MOVE_FUND;
        const payload = await this.getBundlePayload({ type, currency : "TRX", transactions });
        //return { payload };
        // const option = { deep: true };
        // const payload =  { payload: JSON.stringify(snakeCaseKeys(payload, option)) };
        const Signer =  new SignService();
        console.log("Signer",Signer);
        try {
          const body = { currency : "TRX", transactions : payload }
          console.log("body",JSON.stringify(body));
    
          const signedHash=(await Signer.getSignedHashs(JSON.stringify(body)));
          console.log("signedHash",signedHash);
          // const bodyResult = JSON.parse(signedHash);
          if(signedHash.status ==='Success')
          {
            const result= await Promise.map(signedHash.output.transactionsHash , async (transaction_hash) =>{
              console.log("transaction_hash",transaction_hash);
              return (await this.api.broadcast(transaction_hash.hash.hex));
            });
            return result;
    
          }
        }catch (err)
        {
          console.log("err",err);
        }
      }
    }

    async getBundlePayload({ type, currency , transactions }) {
      const blockRef = await this.getBlockRef();
      const meta = { ...blockRef }
      const result = { type ,currency , transactions , meta };
      // const option = { deep: true };
      // const payload = JSON.stringify(snakeCaseKeys(result, option));
      return result;
    }
    async getBlockRef() {
      const { hash, number, timestamp } = await this.api.getLatestBlock();
      return { hash, number, timestamp };
    }
  
}

module.exports = TronMonitor;
