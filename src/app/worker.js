const debug = require("debug")("wallet:worker");
const snakeCaseKeys = require("snakecase-keys");
// const { create: createKafka, TOPIC, PARTITION } = require('./kafkamq');
const Api = require("../lib/api.js");
const log = require("../model/failed_api.js");
const fetch = require("node-fetch");
const crypto = require("crypto");
const keyToken = process.env.KEY_TOKEN;

async function call(body, signature) {
  console.log("*----- WORKER.CALL -----*");
  console.log("body:", body);
  // console.log('signature:',signature)
  const method = "POST";
  const headers = { "Content-Type": "application/json", signature: signature };
  const options = { method, body, headers };
  return await fetch(
    "https://api.kryptoniex.com/internal/crypto-transactions/notify",
    options
  );
}

function create({ monitor, balancesHash }) {
  // const producer = createKafka();
  // When an event emitted from monito
  const sleepTime = 1;
  const maxAttempt = 1;
  const timeout = 20000;
  const baseUrl = "https://api.kryptoniex.com/internal/crypto-transactions/";

  // const api_cl = new Api({baseUrl,sleepTime,maxAttempt,timeout})

  let status = "oke";
  let error = "";

  monitor.on("block", async block => {
    // Convert to json
    console.log("block", block);
    // const token ="73DDEE7525AB2FE401BF8BEEDC73422204DF70800EE1CB350DA667B3DD067B10350DA0D9DC525F13C5679F155E447A83B3DF81C1889EED9873F47C0F75DA663D";
    // const messages = {  block.hash, block.height, block.balancesHash, block.confirmedNetworkTxs ,token  }
    const snakeCaseBlock = snakeCaseKeys(block, { deep: false });
    const jsonBalancesHash = JSON.stringify(snakeCaseBlock);

    const body = jsonBalancesHash;
    // const path="notify";
    hmac = crypto.createHmac("sha256", keyToken);
    hmac.update(body);
    hash = hmac.digest("hex");
    // console.log("Method 2: ", hash);
    const signature = hash;

    try {
      const raw = await call(body, signature);
      try {
        const result = await raw.json();
        status = result.errorMessage;
        error = result.errorMessage;
      } catch (err) {
        error = "oke";
      }
    } catch (errr) {
      // Deal with the fact the chain failed
      // const logApi = new log();
      // logApi.update(snakeCaseBlock.currency,body,errr.Stack)
      status = "not oke";
      console.log("loi ", errr);
      error = errr.message;
      console.log("body", body);
      console.log("loi ", errr);
      console.log("body", body);
    }

    console.log("status", status);
    if (
      status !== "oke" &&
      status !== "Invalid Currency" &&
      status !== "Invalid Balance"
    ) {
      const method = "POST";
      const headers = { "Content-Type": "application/json" };
      console.log("blockAPI", snakeCaseBlock);
      const body = JSON.stringify({
        service: snakeCaseBlock.balances_hash[0].currency,
        body: snakeCaseBlock,
        err: error
      });
      // console.log("body",body);
      const options = { method, body, headers };
      fetch("http://95.216.227.168:3000/catch_log_api", options).then(result =>
        console.log(result)
      );
    }

    // const jsonBalancesHash = JSON.stringify(snakeCaseBlock);

    debug(`New block: ${jsonBalancesHash}`);
    // producer.send(
    //   [
    //     {
    //       topic: TOPIC,
    //       partition: PARTITION,
    //       messages: [jsonBalancesHash],
    //     },
    //   ],
    //   (err, res) => {
    //     debug(err || res);
    //   },
    // );

    balancesHash.add(monitor.name, jsonBalancesHash);
  });

  return monitor;
}

module.exports = { create };
