const fetch = require('node-fetch');
const Promise = require('bluebird');
const Decimal = require('decimal.js');
const debug = require('debug')('wallet:eos_api');
const Rpc = require('eosjs-api');
const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');      
const { TextEncoder, TextDecoder } = require('util');

const defaultPrivateKey = "5JtUScZK2XEp3g9gh7F8bwtPTRAkASmNrrftmx4AxDKD5K4zDnr"; // bob
const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);

const rpc = new JsonRpc('http://95.216.69.201:8888', { fetch });
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });



class  KrpApi{
  constructor({ krpTokenAccount, krpNodeUrl, krpSleepTime }) {
    // Get retry config
    this.sleepTime = Number(krpSleepTime);
    this.MAX_ATTEMPT = 2;
    // this.krpAccountName= krpAccountName;
    // Page for transactions
    // 1 page contains MAX_TRANSACTION_LIMIT transactions
    this.MAX_TRANSACTION_LIMIT = 100;
    this.MAX_PAGES_PER_SECTION = 3;
    this.endPage = 0;
    this.krpTokenAccount = krpTokenAccount;

    
    this.options = {
      httpEndpoint: krpNodeUrl, // default, null for cold-storage
      verbose: false, // API logging
      fetchConfiguration: {
          credentials: 'same-origin'
      },
      fetchConfiguration: {}
    }
  // const fetch = require('node-fetch');           // node only; not needed in browsers
    //  const rpc = Rpc(options);
    this.krp_rpc= Rpc(this.options);
   
  }

  async getBlock(block_number) {
    const blockInfo = await this.krp_rpc.getBlock(block_number);
    return blockInfo;
  }

  async getLatestBlockHeight() {
    const info = await this.krp_rpc.getInfo({});
    return info.head_block_num;
  }

  async getInfo() {
    const blockInfo = await this.krp_rpc.getInfo({});
    return blockInfo;
  }

  async getRequireKeys() {
    const blockInfo = await this.krp_rpc.getRequireKeys;
    return blockInfo;
  }

  async accountExist(hash) {
    const accountInfo = await this.krp_rpc.getAccount(hash);
    if (accountInfo) 
    return true ;
    else 
    return false;
   
  }


  async getBalance(account) {
    const Balance = await this.krp_rpc.getCurrencyBalance( this.krpTokenAccount,account);
    console.log('Balance:',Balance);
    if (Balance) 
    return Balance[0].split(" ")[0] ;
    else 
    return 0;
   
  }

  async getDataFromTransaction(data)
  {
    const result = await this.krp_rpc.abiJsonToBin(data);
    return result
  }

  async findTransactionsByAddress(address, itemsPerPage) {
    const result = (await this.krp_rpc.getActions(address,-1,-itemsPerPage));
    return result.actions;
  }


  
  async broadcast(rawTransactionObj)
  {
    try{
      const broadcast = await api.pushSignedTransaction(rawTransactionObj)
      return broadcast.transaction_id;
    }
    catch (err)
    {
      console.log('Broadcast Error:',err);
      return err.stack
    }
  }
  
}

module.exports = KrpApi
