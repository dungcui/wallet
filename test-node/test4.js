const jayson = require("jayson");
const Promise = require("bluebird");

client = Promise.promisifyAll(
  jayson.client.http("http://admin:secret@95.216.227.170:8332")
);

async function getBlock(blockHash, raw) {
  return (await client.requestAsync("getblock", [blockHash, !raw])).result;
}

async function getBlockHashByHeight(height) {
  return (await client.requestAsync("getblockhash", [height])).result;
}

async function getRawTx(txHash, verbose = 1) {
  return (await client.requestAsync("getrawtransaction", [txHash, verbose]))
    .result;
}

async function decodeRawTransaction(rawTransaction) {
  return (await client.requestAsync("decoderawtransaction", [rawTransaction]))
    .result;
}

async function getLatestBlockHeight() {
  return (await client.requestAsync("getblockcount", [])).result;
}

async function broadcast(hex) {
  return (await client.requestAsync("sendrawtransaction", [hex])).result;
}

async function getSmartFee(minBlockConfirm = 2) {
  return (await client.requestAsync("estimatesmartfee", [minBlockConfirm]))
    .result;
}

getLatestBlockHeight().then(tx => console.log(tx));
