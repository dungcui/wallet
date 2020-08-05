const Promise = require('bluebird');
const Monitor = require('../monitor');
const { buildBalancesHash, buildConfirmNetworkTxs, rangeToArray} = require('../../utils');
const ontology = require('ontology-ts-sdk');
const { OntAssetTxBuilder, Crypto, utils, TransactionBuilder } = ontology;
const { Address, PublicKey , PrivateKey } = Crypto;
const crypto = require("crypto");
const Decimal = require('decimal.js');
const SignService = require('../signService.js');

class OntologyMonitor extends Monitor {
  constructor({
    db,
    block,
    token,
    funding,
    wallet,
    address,
    withdrawal,
    failedApi,
    limit,
    ontologyApi,
    ontologyConstants,
    ontologyInterpreter,
    ONTOLOGY_SLEEP_TIME,
    ONTOLOGY_START_BLOCK_HEIGHT,
    ONTOLOGY_MINIMUM_CONFIRMATION,
    ONTOLOGY_FETCH_BLOCK_CONCURRENCY,
    ontologyPrivatekeyFeeAddress,
    ontologyFeeAddress,
    ONTOLOGY_BASE_FEE
  }) {
    super({
      db,
      block,
      token,
      funding,
      withdrawal,
      failedApi,
      limit,
      api: ontologyApi,
      name: ontologyConstants.SERVICE_NAME,
      sleepTime: Number(ONTOLOGY_SLEEP_TIME),
      startBlockHeight: Number(ONTOLOGY_START_BLOCK_HEIGHT),
      minimumConfirmation: Number(ONTOLOGY_MINIMUM_CONFIRMATION),
      currency: ontologyConstants.CURRENCY,
    });

    this.currency = 'ONT';
    this.interpreter = ontologyInterpreter;
    this.fetchBlockConcurrency = Number(ONTOLOGY_FETCH_BLOCK_CONCURRENCY);
    this.ontologyPrivatekeyFeeAddress = ontologyPrivatekeyFeeAddress;
    this.ontologyFeeAddress = ontologyFeeAddress;
    this.baseFee = ONTOLOGY_BASE_FEE;
    this.wallets = wallet;
    this.addresses = address;
  }

  async fetchRange(fromHeight, toHeight) {
    console.log('*---- ONT_monitor.fetchRange ----*')
    if (fromHeight > toHeight) return;
    const heights = rangeToArray(fromHeight, toHeight);
    console.log('fromHeight:',fromHeight)
    console.log('toHeight:',toHeight)
    await Promise.map(heights.reverse(), async (height) => {
    // await Promise.map(heights, async (height) => {
      if (!this.isRunning) return;

      const block = await this.api.getBlock(height);
      const nextBlock = { hash: block.Hash, height, transactions: [] };

      if (block.Transactions.length) {
        const txs = await this.api.getTxsByHeight(height);
        const parsedTxs = await this.interpreter.parseTransactions(this.name, txs, height);
        nextBlock.transactions = parsedTxs;
      }

      this.nextBlocks.push(nextBlock);
    }, { concurrency: this.fetchBlockConcurrency });
  }

  // Blocks must be processed consecutively
  validateBlock(nextBlock, fromHeight, toHeight) {
    if (!nextBlock) return false;
    return nextBlock.height === fromHeight && fromHeight <= toHeight;
  }

  async distributorGas(req)
  {
    console.log('*---- ONT_monitor.distributorGas ----*');
    const {  toAddress , grossAmount } = req;
    const amount =  new Decimal(grossAmount).toFixed();
    console.log('amount:',amount)
    const privateKey = new PrivateKey(this.ontologyPrivatekeyFeeAddress);
    console.log('this.ontologyFeeAddress:',this.ontologyFeeAddress);
    const toAdr = new Address(toAddress);
    const fromAdr = new Address(this.ontologyFeeAddress) 
    // send 0.01 ONG in order that the user address can move funds to settlement address
    const tx = OntAssetTxBuilder.makeTransferTx('ONG', fromAdr, toAdr, 10000000, 500, 20000);
    tx.nonce = crypto.randomBytes(4).toString('hex');
    const signedTx = await TransactionBuilder.signTransaction(tx, privateKey);
    const hash = tx.serialize();
    console.log('hash:',hash);
    try 
    {
      const transactions = await this.api.broadcast(hash); 
      console.log("transactions",transactions);
      return transactions;
    } catch (err) {
      console.log("err",err);
    }
  }

  async autoMoveFunds(fundings) {
    console.log('*---- ONT_monitor.autoMoveFunds ----*')
    console.log("fundings:" ,fundings);
    // Wait for the transaction fee was moved
    var countMinutesWaited = 0;
    var balanceFee = 0;
    do {
      await Promise.delay(1000 * 60);
      const balance = await this.api.getBalance(fundings[0].toAddress.address);
      balanceFee = parseInt(balance.ong)/Math.pow(10,9);
      console.log('balanceFee:',balanceFee)
      countMinutesWaited++;
    } while ((countMinutesWaited < 10) && (balanceFee < this.baseFee))
    const funding= fundings[0];
    const wallet  = await this.wallets.find(funding.toAddress.walletId);
    const token =  await this.tokens.find(this.name,funding.currency);
    console.log('token:',token)
    if(funding.toAddress.address!==wallet.settlementAddress && funding.toAddress.address !== wallet.coldSettlementAddress)
    {
      let amount = new Decimal(funding.amount).toFixed();
      // if Ontology Gas -> decrease 0.01 ONG fee
      if ((funding.currency == 'ong') || (funding.currency == 'ONG'))
      {
        amount = amount - this.baseFee
      }
      const transactions = [{
        id: 1,
        fromPath: funding.toAddress.path,
        toPath: this.addresses.path.SETTLEMENT,
        amount,
        currency: funding.currency,
      }];
      // console.log("transactions",transactions);
      const payload = {
        type: this.bundleType.MOVE_FUND,
        currency: funding.currency,
        transactions,
        meta: await this.interpreter.getMeta(token)
      };
      console.log('payload:',payload)
      
      const Signer =  new SignService();
      console.log("Signer",Signer);
      try {
        const body = { currency: this.currency, transactions : payload }
        console.log("body",JSON.stringify(body));
    
        const signedHash=(await Signer.getSignedHashs(JSON.stringify(body)));
        console.log("signedHash",signedHash);
        // const bodyResult = JSON.parse(signedHash);
        if(signedHash.status ==='Success')
        {
          const result= await Promise.map(signedHash.output.transactionsHash , async (transaction_hash) =>{
            console.log("transaction_hash",transaction_hash);
            return (await this.api.broadcast(transaction_hash.hash));
          });
          return result;
        }
      }catch (err)
      {
        console.log("err",err);
      }
    }
  }

  async processBlock({ height, hash, transactions }) {
    console.log('*---- ONT_monitor.processBlock ----*')
    await this.db.transaction(async (trx) => {
      this.debug(`Process block ${height}`);
      // Analyze fundings

      console.log('transactions:',transactions)

      /// deposit
      const fundings = await this.buildFundings(transactions, trx);
      console.log('fundings:',fundings)
      const balancesHash = buildBalancesHash(fundings);

      // Analyze withdrawals
      const withdrawals = await this.buildWithdrawals(transactions, trx);
      const unknownWithdrawals = await this.buildUnknownWithdrawals(withdrawals, trx);
      const confirmedNetworkTxs = buildConfirmNetworkTxs(withdrawals);

      // Update database
      await Promise.each(unknownWithdrawals, tx => this.withdrawals.add(tx, trx));
      // Use only for UTXO: processWithdrawal, markAsConfirmed
      // await Promise.each(withdrawals, tx => this.processWithdrawal(tx, trx));
      // await Promise.each(withdrawals, tx =>
      //   this.withdrawals.markAsConfirmed(this.name, tx.transactionHash, trx));
      await Promise.each(fundings, tx => this.fundings.add(tx, trx));

      // Submit new block
      const block = { hash, height, balancesHash, confirmedNetworkTxs  };
      await this.blocks.update(this.name, height, trx);
      // console.log(`tokenhash:${this.tokenHash}`);

      // Only emit if necessary
      console.log("balancesHash:",balancesHash);
      if ( balancesHash.length  || confirmedNetworkTxs.length ) 
      {
        this.emit('block', block);
        if (balancesHash.length)
        {
          console.log('balancesHash[0].address:',balancesHash[0].address)
          const balance = await this.api.getBalance(balancesHash[0].address);
          const balanceFee = parseInt(balance.ong)/Math.pow(10,9);
          console.log("balance:",balance);
          console.log('this.baseFee:',this.baseFee)
          if(balanceFee < this.baseFee ){
            const req = {
              toAddress   : fundings[0].toAddress.address,
              grossAmount : this.baseFee
            }
            try {
              const distributeGas = await this.distributorGas (req);
              console.log('distributeGas:',distributeGas);
            } 
            catch (err){
              console.log('distributeGas.err:',err);
            }
          }

          const req = fundings;
          const movefund = this.autoMoveFunds(req);
        }
      }
    });
  }
}

module.exports = OntologyMonitor;
