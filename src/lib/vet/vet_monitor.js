const Decimal = require('./vet_utils').decimal();
const Promise = require('bluebird');
// const debug = require('debug')('wallet:vet_monitor');
const Monitor = require('../monitor');

class VetMonitor extends Monitor {
  constructor({
    db,
    vetApi,
    vetBlock,
    vetSleepTime,
    vetTransaction,
    vetStartBlockHeight,
    vetMinimumConfirmation,
    vetAddress,
    failedApi,
    limit,
  }) {
    super({
      db,
    });
    this.currencies = ['VET', 'VTHO'];
    this.startBlockHeight = Number(vetStartBlockHeight);
    this.sleepTime = Number(vetSleepTime);
    this.transactions = vetTransaction;
    this.addresses = vetAddress;
    this.blocks = vetBlock;
    this.api = vetApi;
    this.db = db;
    this.minimumConfirmation = Number(vetMinimumConfirmation);
    this.tokenHash = process.env.TOKEN_HASH;
    this.failedApi=failedApi;
    this.limit = limit;
  }


  async run() {

    
    if (!this.isRunning) return;

    // const errApis=await this.failedApi.get(this.name);
    // console.log("err_apis",errApis);
    // await Promise.each(errApis , async (errApi) =>{
    //   this.emit('block', JSON.parse(errApi.body));
    //   this.failedApi.delete(errApi.service, errApi.id);
    // })
    const latestBlock = await this.blocks.getLatest();

    const curHeight = latestBlock
      ? latestBlock.height + 1
      : this.startBlockHeight;

    const curNetworkHeight = await this.api.getLatestBlockHeight();
    console.log("curNetworkHeight",curNetworkHeight)
    const confirmedHeight = curNetworkHeight - this.minimumConfirmation;
    console.log("confirmedHeight",confirmedHeight)

    if (confirmedHeight >= curHeight) {
      // Add a small delay to prevent spamming requests
      await Promise.delay(100);
      await this.processBlock({ height: curHeight });
    } else {
      await Promise.delay(1000 * this.sleepTime);
    }

    await this.run();
  }


  async buildBalancesHash(transactions) {
    if (!transactions || !transactions.length) return { [this.currencies[0]]: {} };

    let balancesHash = [];

    transactions.forEach((tx) => {
      tx.clauses.forEach((clause) => {
        if (clause.address && clause.address.type === this.addresses.TYPE.USER) {
          const amount = new Decimal(clause.value);
          const txHash = tx.id;

          if (amount.lte(0)) return;

          // balancesHash[clause.to] = balancesHash[clause.to] || {};
          // balancesHash[clause.to][txHash] = amount
          //   .div(this.api.WEI_TO_VET).add(balancesHash[clause.to][txHash] || 0)
          //   .toFixed();
          balancesHash.push({currency :this.currencies[0] ,address : clause.address.hash, transactionHash: txHash,amount: amount.div(this.api.WEI_TO_VET).toFixed()})
        }
      });
    });
    // console.log("balancesHash 1111111",balancesHash);
    if(balancesHash.length==0)
    {
      return ;
    }else
    {
      return balancesHash;
    }
  }



  formatTxs(txs = []) {
    const copied = Object.assign([], txs);

    copied.forEach((tx, i) => {
      tx.clauses.forEach((clause, j) => {
        let toAddress;

        if (clause.data === '0x') {
          toAddress = clause.to;
        } else if (clause.to === this.transactions.VTHO_CONTRACT_ADDRESS) {
          toAddress = `0x${clause.data.substr(34, 40)}`;
        }

        copied[i].clauses[j].toAddress = toAddress;
      });
    });
    return copied;
  }


  async mapAddressToTxs(transactions, trx) {
    const formattedTxs = this.formatTxs(transactions);
    const hashes = formattedTxs
      .reduce((acc, tx) => [...acc, ...tx.clauses.map(cl => cl.toAddress)], [])
      .filter(hash => hash); // remove null or undefined

    const addresses = await this.addresses.findByAddresses(hashes, trx);
    const addrMap = addresses.reduce((acc, add) => ({ ...acc, [add.hash]: add }), {});

    formattedTxs.forEach((tx, i) => {
      tx.clauses.forEach((clause, j) => {
        const address = addrMap[clause.toAddress];
        if (address) formattedTxs[i].clauses[j].address = address;
      });
    });
    // console.log("formattedTxs",formattedTxs);
    return formattedTxs;
  }


  async processBlock({ height }) {
    const block = await this.api.getBlock(height);
    if (!block) return;

    const { transactions: txHashes, id: blockHash } = block;
    let transactions = [];

    await Promise.each(txHashes, async (txHash) => {
      let txData = await this.getTransactionAgain(txHash);

      if (!txData || !txData.clauses) {
        throw Error(`Can not find data of transaction ${txHash}`);
      }
      // console.log("transactions",txData.clauses);

      transactions.push(txData);
    });

    console.log("transactions",transactions);

    await this.db.transaction(async (trx) => {
      transactions = await this.mapAddressToTxs(transactions, trx);

      const confirmedHashes = await this.transactions.confirmTxs(transactions, trx);
      const confirmedNetworkTxs =  confirmedHashes ;

      await this.transactions.addFundingTxs(transactions, trx);
      const balancesHash = await this.buildBalancesHash(transactions);

      await this.blocks.add({ height }, trx);
      
      // console.log("balancesHash",balancesHash);
      if(transactions.length>0 && balancesHash )
      {
        this.emit('block', {
          height,
          hash: blockHash,
          balancesHash,
          confirmedNetworkTxs,
          // token : this.tokenHash 
        });
      }
    });
  }
  async getTransactionAgain(tx)
  {
    let transaction = await this.api.getTransaction(tx);
    if (!transaction || !transaction.clauses) {
      Promise.delay(1000 * this.sleepTime);
      transaction = await this.getTransactionAgain(tx);
    }
    return transaction;
  }

}

module.exports = VetMonitor;
