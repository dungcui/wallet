const jayson = require("jayson");
const Promise = require("bluebird");
const utils = require("../src/lib/erc20/erc20_utils");
const rpc = require("../src/lib/erc20/erc20_rpc");
const client = Promise.promisifyAll(
  jayson.client.http("http://95.216.227.169:8545")
);
const Decimal = require("decimal.js");

const object = utils.getObject(
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "decimals()",
  []
);
async function ethCall(object, block = "latest") {
  return (await client.requestAsync("eth_call", [object, block])).result;
}

ethCall(object).then(hex => {
  const decimals = new Decimal(hex).toNumber();
  console.log(decimals);
});
