const fetch = require('node-fetch');
const Decimal = require('decimal.js');
const Promise = require('bluebird');
const { resolve: urlResolve } = require('url');
const  sdk = require('@binance-chain/javascript-sdk');
const txHexDecoder = require("raw-transaction-hex-decoder"); 

  
  
  const base = "http://dataseed1.binance.org";

    // Get retry config
    const sleepTime = Number(10);

    // 1 TRX = 1,000,000 sun
    const DECIMALS = 6;
    const ONE_TRX = new Decimal(1e6);
    const MAX_ATTEMPT = 10;



  async function get(path, attempt = 0) {
    try {
      const url = urlResolve(base, path);
      const raw = await fetch(url, { timeout: 5000 });

      // await this.constructor.validateRequest(raw);

      // debug(`Get ${path} success`);
      const jsonResult= await raw.json();
      return jsonResult
    } catch (err) {
      // No retry if MAX_ATTEMPT is 0
      if (MAX_ATTEMPT === 0) throw err;

      if (attempt >= MAX_ATTEMPT) {
        // throw Error(`Failed after ${attempt} retries on path ${path}, exit.`);
      }

      // debug(`GET  ${this.base} ${path} failed, retry...`);
      await Promise.delay(1000 * sleepTime);
      return get(path, attempt + 1);
    }
  }
  

async function post(path, body, attempt = 0) {
    if (attempt === MAX_ATTEMPT) {
      // throw Error(`Failed after ${attempt} retries on path ${path}, exit.`);
    }

    const method = 'POST';
    const options = { method, body };
    try {
      const raw = await fetch(base + path, options);
      if (raw.status !== 200) throw Error();
      return raw.json();
    } catch (err) {
    //   debug(`GET ${path} with ${body} failed, retry...`);
      return post(path, body, attempt + 1);
    }
  }

async function getBlock(num) {
    return post('/wallet/getblockbynum', JSON.stringify({ num }));
  }

// async function getLatestBlock() {
//     return post('/wallet/getnowblock');
//   }

  async function getBlock(num) {
    return   get(`/tx_search?query=tx.height=${num}&prove=true`);
  }

  async function getLatestBlockHeight() {
    const info = await (get('/status'))
    return  info.sync_info.latest_block_height;
  }


  // getLatestBlockHeight().then(block => console.log(block))


  const url = urlResolve("http://dataseed1.binance.org", "/tx_search?query=\"tx.height=15817126\"&prove=true");
  console.log(url);
  
  fetch(url, { timeout: 5000 }).then(raw => raw.json().then(block => console.log(block.result.txs)));

    let txnDt = Buffer.from("yAHwYl3uCk4qLIf6CiMKFJGTdSD0BFj1tBTSZ5YbRsGXid1wEgsKA0JOQhCEwdLZZhIjChTk1a25FEhra6dWceqTDYRNxKckGBILCgNCTkIQhMHS2WYScAom61rphyEDVuClgDiab9LMkc1SXG1aTYBUr3DfF0hOWGePn1dKC00SQOw/pdWSO0A7WEaMPRk2oacNmtEVjr1PxJCWlFSi3tG7Gxwm3ktKayn1mAQXhSohn8fBYWd8asi7eDf8uyrKa6QYMyCxygYgAg==", "base64").toString('hex');

    let decodedTx = txHexDecoder.decodeBnbRawTx(txnDt, 'Transfer');
    // console.log("decodedTx",sdk.crypto.encodeAddress(decodedTx.msg[0].outputs[0].address,'bnb'));
    // console.log("decodedTx",decodedTx.msg[0].outputs[0]);

    // console.log(sdk.amino.encodeString("yAHwYl3uCk4qLIf6CiMKFJGTdSD0BFj1tBTSZ5YbRsGXid1wEgsKA0JOQhCEwdLZZhIjChTk1a25FEhra6dWceqTDYRNxKckGBILCgNCTkIQhMHS2WYScAom61rphyEDVuClgDiab9LMkc1SXG1aTYBUr3DfF0hOWGePn1dKC00SQOw/pdWSO0A7WEaMPRk2oacNmtEVjr1PxJCWlFSi3tG7Gxwm3ktKayn1mAQXhSohn8fBYWd8asi7eDf8uyrKa6QYMyCxygYgAg=="))
