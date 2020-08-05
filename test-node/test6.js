// Get retry config
const sleepTime = Number(1000);
const MAX_ATTEMPT = 2;
// const eosAccountName= eosAccountName;
// Page for transactions
// 1 page contains MAX_TRANSACTION_LIMIT transactions
const MAX_TRANSACTION_LIMIT = 100;
const MAX_PAGES_PER_SECTION = 3;
const endPage = 0;
// consteosTokenAccount = eosTokenAccount;
const Rpc = require('eosjs-api');
const Decimal = require('decimal.js');




const options = {
  httpEndpoint: "http://95.216.69.201:8888", // default, null for cold-storage
  verbose: false, // API logging
  fetchConfiguration: {
      credentials: 'same-origin'
  },
  fetchConfiguration: {}
}
// const fetch = require('node-fetch');           // node only; not needed in browsers
//  const rpc = Rpc(options);
const eos_rpc= Rpc(options);


async function getBlock(block_number) {
const blockInfo = await eos_rpc.getBlock(block_number);
return blockInfo;
}

async function getLatestBlockHeight() {
const info = await eos_rpc.getInfo({});
return info.head_block_num;
}

async function getInfo() {
const blockInfo = await eos_rpc.getInfo({});
return blockInfo;
}

async function getRequireKeys() {
const blockInfo = await eos_rpc.getRequireKeys;
return blockInfo;
}

async function accountExist(hash) {
const accountInfo = await eos_rpc.getAccount(hash);
if (accountInfo) 
return true ;
else 
return false;

}


async function getBalance() {
const Balance = await eos_rpc.getCurrencyBalance( eosTokenAccount,eosAccountName);
if (Balance) 
return Balance[0].split(" ")[0] ;
else 
return 0;

}

async function getDataFromTransaction(data)
{
const result = await eos_rpc.abiJsonToBin(data);
return result
}

async function findTransactionsByAddress(address) {
const result = (await eos_rpc.getActions(address,-1,-50));
return result.actions;
}

findTransactionsByAddress("krpkryptanhw").then(tx =>console.log(parseAmount(tx[0].action_trace.act.data.quantity)));
function parseAmount(amount) {
  const [value, currency] = amount.split(' ');
  return {
    value: new Decimal(value).toFixed(),
    currency: currency.toUpperCase(),
  };
}