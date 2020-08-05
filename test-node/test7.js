const jayson = require('jayson');
const Promise = require('bluebird');



    const nodeUrl = "http://s2.ripple.com:51234";
    if (!nodeUrl) {
      throw Error('Please provide XRP_NODE_URL');
    }
    const client = Promise.promisifyAll(jayson.client.http(nodeUrl));
  

  async function getLedgerByIndex(index) {
    try {
      return (await client.requestAsync('ledger', [{ ledger_index: index, transactions: true }]))
      .result.ledger;   
    }
    catch(ex)
    {
      return (await client.requestAsync('ledger', [{ ledger_index: index, transactions: true }]))
      .result.ledger;    
    }
    
  }

  async function getRawTx(txHash) {
    try {
      return (await client.requestAsync('tx', [{ transaction: txHash }])).result;
  
    }
    catch(ex)
    {
      return (await client.requestAsync('tx', [{ transaction: txHash }])).result;
   
    }
  }

  async function getLatestBlockHeight() {
    try {
      return (await client.requestAsync('ledger_current', [{}])).result.ledger_current_index;
  
    }
    catch(ex)
    {
      return (await client.requestAsync('ledger_current', [{}])).result.ledger_current_index;
   
    }
  }

  async function broadcast(hex) {
    try {
      return (await client.requestAsync('submit', [{ tx_blob: hex }])).result;
  
    }
    catch(ex)
    {
      return (await client.requestAsync('submit', [{ tx_blob: hex }])).result;
   
    }
  }

  async function getAccountInfo(address) {
    try {
      return (await client.requestAsync('account_info', [{ account: address }])).result
      .account_data;  
    }
    catch(ex)
    {
      return (await client.requestAsync('account_info', [{ account: address }])).result
      .account_data;   
    }
    }
   
    getAccountInfo("rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh").then(address => console.log(address));