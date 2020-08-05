const snakeCaseKeys = require('snakecase-keys');
const hdkey = require('hdkey');
const Decimal = require('decimal.js');
const Promise = require('bluebird');
const debug = require('debug')('wallet:tron_service');
const keyToken  = process.env.KEY_TOKEN;
const crypto = require('crypto')
const SignService = require('../signService');
const transactionBuilder = require('@tronscan/client/src/utils/transactionBuilder');

class TronService {
  constructor({
    db,
    tronApi,
    tronWallet,
    tronRpc,
    tronAddress,
    tronParser,
    tronTransaction,
    withdrawal,
  }) {
    this.db = db;
    this.api = tronApi;
    this.currencies = ['TRX'];
    this.wallets = tronWallet;
    this.addresses = tronAddress;
    this.transactions = tronTransaction;
    this.withdrawals = withdrawal;
    this.parser = tronParser;
    this.api = tronApi;
    this.rpc = tronRpc;

    // Withdrawal Transaction always has id > 0. So -1 is safe choose
    this.MOVE_FUND_TRANSACTION_ID = -1;

    this.error = {
      EMPTY_PATH: 'Path empty.',
      MISSING_XPUB: 'Missing public key.',
      INVALID_XPUB: 'Invalid public key.',
      MISSING_PAYLOAD: 'Missing payload.',
      INVALID_PAYLOAD: 'Invalid payload.',
      WALLET_NOT_FOUND: 'Wallet not found.',
      INSUFFICIENT_BALANCE: 'Insufficient balance',
      MISSING_TRANSACTIONS: 'Missing transactions.',
      NO_SETTLEMENT: 'No settlement address in database.',
      NO_USER_BALANCE: 'No user address has balance now.',
      ERR_501: ' Not authorized',
    };
  }

  async addWallet(req) {
    if (!(req && req.xpubs && req.xpubs.length)) throw Error(this.error.MISSING_XPUB);
    // const { xpubs ,xpubsColdWallets} = req;
    const [xpub] = req.xpubs;
    const [xpubsColdWallets] = req.xpubsColdWallets;

    // Validate xpub
    try {
      hdkey.fromExtendedKey(xpub);
      hdkey.fromExtendedKey(xpubsColdWallets);
    } catch (err) {
      throw Error(this.error.INVALID_XPUB);
    }

    // Then add to database
    return this.db.transaction(async (trx) => {
      const [id] = await this.wallets.add({ xpub ,xpubsColdWallets}, trx);
      const wallet = { id, xpub ,xpubsColdWallets};
      const settlement = {
        path: this.addresses.SETTLEMENT_PATH,
        type: this.addresses.type.SETTLEMENT,
      };

      const coldSettlement = {
        path: this.addresses.COLD_PATH,
        type: this.addresses.type.COLD,
      };
      const address = { wallet, req: settlement };
      console.log('address:',address)
      const { hash: changeAddress } = await this.addresses.generate(address, trx);
      const addressColdWallet = { wallet, req: coldSettlement };
      console.log('addressColdWallet:',addressColdWallet)
      await this.addresses.generateCold(addressColdWallet, trx);
      const feeAddress = ''; // TRX doesn't have fee address
      return { id, changeAddress, feeAddress };
    });
  }

  async getAddress(req) {
    const { walletId, path } = req;
    if (!walletId) throw Error(this.error.WALLET_NOT_FOUND);
    if (!path || path.length === 0) throw Error(this.error.EMPTY_PATH);

    return this.db.transaction(async (trx) => {
      // Validate
      const wallet = await this.wallets.load({ id: walletId }, trx);
      if (!wallet) { throw Error(this.error.WALLET_NOT_FOUND); }

      // Get
      const { hash } =
        await this.addresses.load({ walletId, path }, trx) ||
        await this.addresses.generate({
          wallet,
          req: { walletId, path, type: this.addresses.type.USER },
        }, trx);

      debug(`Get address from path m/${path}: ${hash}`);
      return { hash };
    });
  }

  async validateAddress(req) {
    const { hash } = req;
    const valid = await this.addresses.validate({ hash });
    return { valid };
  }

  async getBlockRef() {
    const { hash, number, timestamp } = await this.api.getLatestBlock();
    return { hash, number, timestamp };
  }

  async getBundlePayload({ type, currency , transactions }) {
    const blockRef = await this.getBlockRef();
    const meta = { ...blockRef }
    const result = { type ,currency , transactions , meta };
    const option = { deep: true };
    const payload = JSON.stringify(snakeCaseKeys(result, option));
    return payload;
  }

  async bundleMoveFund(req , isColdWallet = true) {
    const { currency , walletId } = req;

    return this.db.transaction(async (trx) => {
      // Check wallet
      const wallet = await this.wallets.load({ id: walletId }, trx);
      console.log('wallet:',wallet);
      if (!wallet) { throw Error(this.error.WALLET_NOT_FOUND); }

      // Load settlement
      const settlement = { walletId, type: this.addresses.type.SETTLEMENT };
      const destination = await this.addresses.load(settlement, trx);
      if (!destination) throw Error(this.error.NO_SETTLEMENT);

      // Load all move fund needed transactions
      const sourceTxs = await this.transactions.loadAllMoveFundNeeded(walletId, trx,isColdWallet);
      if (!sourceTxs || sourceTxs.length === 0) throw Error(this.error.NO_USER_BALANCE);
      console.log('sourceTxs:',sourceTxs);
      const transactions = sourceTxs.map(transaction => ({
        id: this.MOVE_FUND_TRANSACTION_ID,
        moveFundForId: transaction.id,
        fromPath: transaction.toPath,
        toPath: destination.path,
        // decimals: this.api.DECIMALS,
        amount: new Decimal(transaction.grossAmount).toString(),
      }));
      
      const type = this.transactions.type.MOVE_FUND;
      const payload = await this.getBundlePayload({ type, currency, transactions });
      return { payload };
    });
  }

  async bundleWithdrawal(req, isColdWallet = true) {
    const { currency, walletId, transactions: destinationTxs } = req;

    // Check transaction
    if (!destinationTxs || destinationTxs.length === 0) {
      throw Error(this.error.MISSING_TRANSACTIONS);
    }

    return this.db.transaction(async (trx) => {
      // Check wallet
      const wallet = await this.wallets.load({ id: walletId }, trx);
      if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);

      // Load settlement
      let settlement= {};
      if (!isColdWallet)
      {
        settlement = { walletId, type: this.addresses.type.SETTLEMENT };
      }  else  {
        settlement = { walletId, type: this.addresses.type.COLD };
      }
      const source = await this.addresses.load(settlement, trx);
      const maximumBalance = await this.addresses.getNetworkBalance(source, trx);

      console.log("source",source);
      console.log("maximumBalance",maximumBalance);

      // Check amount
      const total = destinationTxs.reduce((sum, { amount }) =>
        sum.add(this.api.ONE_TRX.mul(amount)), new Decimal(0));
      if (total.gt(maximumBalance)) throw Error(this.error.INSUFFICIENT_BALANCE);

      const transactions = destinationTxs.map(transaction => ({
        id: transaction.id,
        fromPath: source.path,
        toAddress: transaction.address,
        amount: this.api.ONE_TRX.mul(transaction.amount).toString(),
        // decimals: this.api.DECIMALS,
      }));
      
      const type = this.transactions.type.WITHDRAWAL;
      const payload = await this.getBundlePayload({ type, currency,  transactions });
      return { payload };
    });
  }

  async getStatus(req) {
    const { walletId } = req;
    if (!walletId) throw Error(this.error.WALLET_NOT_FOUND);
    return this.db.transaction(async (trx) => {
      const wallet = await this.wallets.load({ id: walletId }, trx);
      if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);

      // availableWithdrawal
      const settlement = { walletId, type: this.addresses.type.SETTLEMENT };
      const settlementAddress = await this.addresses.load(settlement, trx);
      const availableWithdrawal = await this.addresses.getNetworkBalance(settlementAddress);

      // availableBalance
      const totalMoveFundNeeded = await this.transactions.loadTotalMoveFundNeeded(walletId, trx);
      const availableBalance = availableWithdrawal.add(totalMoveFundNeeded);

      // totalBalance
      const totalMoveFundPending = await this.transactions.loadTotalMoveFundPending(walletId, trx);
      const totalBalance = availableBalance.add(totalMoveFundPending);

      return {
        availableWithdrawal: availableWithdrawal.div(this.api.ONE_TRX).toString(),
        availableBalance: availableBalance.div(this.api.ONE_TRX).toString(),
        totalBalance: totalBalance.div(this.api.ONE_TRX).toString(),
      };
    });
  }

  async bundleTransactions(req) {
    const { type, walletId } = req;
    if (!walletId) throw Error(this.error.WALLET_NOT_FOUND);
    return type === this.transactions.type.MOVE_FUND
      ? this.bundleMoveFund(req)
      : this.bundleWithdrawal(req);
  }

  async broadcast(req) {
    console.log('*---- TRON_Service.broadcast ----*');
    const { payload } = req;
    console.log('payload:',payload)
    if (!payload) throw Error(this.error.MISSING_PAYLOAD);
    const { type, transactionsHash: txsHash } = JSON.parse(payload);
    if (!txsHash || !type) throw Error(this.error.INVALID_PAYLOAD);
    const txEntries = Object.entries(txsHash);
    // const successTxsHash = {};
    const successTxsHash = [];
    let settlementHash;

    return this.db.transaction(async (trx) => {
      await Promise.each(txEntries, async ([id, tx]) => {
        const response = await this.api.broadcast(tx.hash.hex);
        console.log('response:',response);
        debug(`Broadcast transaction response: ${JSON.stringify(response)}`);
        if (!response.success) return;
        tx.externals.forEach((external) => {
          successTxsHash.push({
            externalId: external.id,
            transactionHash: tx.hash.txId,
            outputIndex: external.index
          });
        });
        // settlementHash = response.transaction.contracts[0].from;
        // successTxsHash[id] = response.transaction.hash;
      });

      if (type === this.transactions.type.MOVE_FUND) {
        await this.transactions.addPendingMoveFund(successTxsHash, trx);
        console.log('Tron_service.After addPendingMoveFund');
        // return { payload: JSON.stringify({})};
        return { payload: JSON.stringify([])};
      }
      // No transactions was successful broadcasted
      // if (!settlementHash) return { payload: JSON.stringify({}) };

      // We got at least one success
      // const { walletId } = await this.addresses.load({ hash: settlementHash }, trx);
      // await this.transactions.addPendingWithdrawal(successTxsHash, walletId, trx);
      return { payload: JSON.stringify(successTxsHash) };
    });
  }

  // Get balance of settlement address (admin wallet)
  async getTotalBalance (currency , walletId, isColdWallet = true)
  {
    isColdWallet = (isColdWallet==='true');
    return this.db.transaction(async (trx) => {
      let totalBalance = "";
      let settlement = {};
      try {
        if(!isColdWallet)
        {
          settlement = { walletId , type: this.addresses.type.SETTLEMENT };
        } else 
        {
          settlement = { walletId , type: this.addresses.type.COLD };
        }
        const address = await this.addresses.load(settlement, trx);
        const balance = await this.addresses.getNetworkBalance(address, trx);
        totalBalance = balance.div(this.api.ONE_TRX).toString()
      }
      catch (err){
        console.log('TRX.getTotalBalance.err:',err);
        totalBalance = "0";
      }
      console.log('TRX.totalBalance:',totalBalance);
      return {currency, totalBalance}
    })
  }

  async withdrawCurrency(rawBody,req,signature) {
    console.log('*---- Tron_Service.withdrawCurrency ----*')
    // console.log("signature",signature);
    // console.log("body",JSON.stringify(req));

    const hmac = crypto.createHmac('sha256', keyToken);
    hmac.update(rawBody);
    const hash = hmac.digest('hex');
    // console.log("Method 2: ", hash);
    const encypHash = hash;
    if(encypHash !== signature)
    {
      throw Error(this.error.ERR_501);
    } else {
      const { currency, type, walletId , transactions } = req;
      if (!walletId) throw Error(this.error.MISSING_WALLET_ID);
      try {
        await Promise.each(transactions, async (transaction) =>{
          const found = await this.withdrawals.findAllByExternalId(this.name,transaction.id);
          // console.log("found",found ,"this.name",this.name, "transaction.id",transaction.id);
          if(found.length >0 )
          {
            throw Error(this.error.DUPLICATED_WITHDRAWAL);
          }
        });
      } catch(err) 
      {
        // console.log("err",err)
        throw Error(this.error.DUPLICATED_WITHDRAWAL);
      }
      const payload = (type === this.transactions.type.MOVE_FUND
        ? await this.bundleMoveFund(req)
        : await this.bundleWithdrawal(req,false));
      // console.log("payload",payload.payload);
      const Signer =  new SignService();
      // console.log("Signer",Signer);
      try {
        const body = { currency : req.currency, transactions : JSON.parse(payload.payload) }
        // console.log("body",JSON.stringify(body));

        const signedHash=(await Signer.getSignedHashs(JSON.stringify(body)));
        // console.log("signedHash",signedHash);
        // const bodyResult = JSON.parse(signedHash);
        if(signedHash.status ==='Success')
        {
          const payloadBroadcast = {currency : signedHash.output.currency , payload : JSON.stringify(signedHash.output)}
          console.log("payloadBroadcast",payloadBroadcast);
          return this.broadcast(payloadBroadcast);
        }

      }catch (er){
        console.log("err",er);
      }
    }
  }

  async getLastestBlock(currency) {
    const block = this.parser.parseBlock(await this.rpc.getLatestBlock());
    return { currency, height : block.height };
  }
}

module.exports = TronService;
