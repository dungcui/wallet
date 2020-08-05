// const jayson = require("jayson");
// const Promise = require("bluebird");
const Web3 = require("web3");

const nodeUrl = "ws://95.216.227.169:8546";
if (!nodeUrl) {
  throw Error("Please provide ETHEREUM_NODE_URL");
}

const web3 = new Web3();
web3.setProvider(new Web3.providers.WebsocketProvider(nodeUrl));
// const client = Promise.promisifyAll(jayson.client.http(nodeUrl));

async function ethCall(object, block = "latest") {
  return (await client.requestAsync("eth_call", [object, block])).result;
}

async function getBlock(number, verbose = true) {
  const blockInfo = await web3.eth.getBlock(number, verbose);
  return blockInfo;
}

async function getBlockHashByHeight(height, verbose = true) {
  const block = await web3.eth.getBlock(height, verbose);
  return block;
}

async function getRawTx(txHash) {
  const transaction = await web3.eth.getTransaction(txHash);
  return transaction;
}

async function decodeRawTransaction(rawTransaction) {
  return web3.utils.sha3(rawTransaction);
}

async function getTransactionFromBlock(hashStringOrNumber, index) {
  const transaction = await web3.eth.getTransactionFromBlock(
    hashStringOrNumber,
    index
  );
  return transaction;
}

async function getLatestBlockHeight() {
  const number = await web3.eth.getBlockNumber();
  if (!number) {
    const sync = await web3.eth.isSyncing();
    if (sync) {
      return sync.currentBlock;
    }
    return 0;
  }
  return number;
}

async function broadcast(hex) {
  const data = await web3.eth.sendSignedTransaction(`0x${hex}`);
  return data;
}

async function getBalance(address) {
  const data = await web3.eth.getBalance(address);
  return data;
}

async function checkConnecttion() {
  const connect = await web3.eth.net.isListening();
  return connect;
}

decodeRawTransaction(
  "f8aa7e8514f46b0400830186a094002f2264aeec71041ae5739ecf0a2c80c5ea30fa80b844a9059cbb000000000000000000000000dffd60aa618b98bc183052aae0134b07f6f7db8d0000000000000000000000000000000000000000000000000de0b6b3a76400001ca061aff10a6f3253c2ce01ab4944ced97dbc8ee9c7425e71b609e0d3061bd54698a03e39804a379066cae25c7cdaa7844bc967fedd7903f19493816936d89ea126f5"
).then(block => console.log(block));
