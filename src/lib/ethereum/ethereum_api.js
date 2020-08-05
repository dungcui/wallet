const jayson = require("jayson");
const Promise = require("bluebird");
const Web3 = require("web3");

class EthereumApi {
  constructor(web3, ethereumNodeUrl) {
    this.nodeUrl = ethereumNodeUrl;
    // if (!this.nodeUrl) {
    //   throw Error('Please provide ETHEREUM_NODE_URL');
    // }
    this.sleepTime = 10;
    this.MAX_ATTEMPT = 20;
    this.web3 = web3;
    // this.web3.setProvider(new Web3.providers.HttpProvider(this.nodeUrl));
    this.client = Promise.promisifyAll(jayson.client.http(this.nodeUrl));
  }

  async initWSConnect() {
    this.web3._provider.on("connect", async () => {
      return;
    });
    this.web3._provider.on("error", async () => {
      await Promise.delay(1000 * this.sleepTime);
      var provider = new Web3.providers.WebsocketProvider(this.nodeUrl);
      provider.on("connect", async function() {
        console.log("WSS Reconnected");
        this.web3 = new Web3(provider);
        return;
      });
    });
    this.web3._provider.on("end", async () => {
      console.log("WS closed");
      console.log("Attempting to reconnect...");
      await Promise.delay(1000 * this.sleepTime);
      var provider = new Web3.providers.WebsocketProvider(this.nodeUrl);
      provider.on("connect", async function() {
        console.log("WSS Reconnected");
        this.web3 = new Web3(provider);
        return;
      });
    });
  }

  async ethCall(object, block = "latest", attempt = 0, callback) {
    try {
      //await this.initWSConnect();
      return (await this.client.requestAsync("eth_call", [object, block]))
        .result;
    } catch (ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.ethCall(object, (block = "latest"), attempt + 1);
    }
  }

  async getBlock(number, verbose = true, attempt = 0) {
    try {
      //await this.initWSConnect();
      const blockInfo = await this.web3.eth.getBlock(number, verbose);
      return blockInfo;
    } catch (ex) {
      console.log("ex ", ex);
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getBlock(number, (verbose = true), attempt + 1);
    }
  }

  async getBlockHashByHeight(height, verbose = true, attempt = 0) {
    try {
      //await this.initWSConnect(this.web3);
      const block = await this.web3.eth.getBlock(height, verbose);
      // console.log("block :",block);
      return block;
    } catch (ex) {
      console.log("ex ", ex);
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getBlockHashByHeight(
        height,
        (verbose = true),
        attempt + 1
      );
    }
  }

  async getRawTx(txHash, attempt = 0) {
    try {
      //await this.initWSConnect();
      const transaction = await this.web3.eth.getTransaction(txHash);
      return transaction;
    } catch (ex) {
      console.log("ex ", ex);
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getRawTx(txHash, attempt + 1);
    }
  }

  async getTransactionReceipt(txHash, attempt = 0) {
    try {
      //await this.initWSConnect();
      const transaction = await this.web3.eth.getTransactionReceipt(txHash);
      return transaction;
    } catch (ex) {
      console.log("ex ", ex);
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getTransactionReceipt(txHash, attempt + 1);
    }
  }

  async decodeRawTransaction(rawTransaction, attempt = 0) {
    try {
      // await this.initWSConnect();
      return this.web3.utils.sha3(rawTransaction);
    } catch (ex) {
      console.log("ex ", ex);
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.decodeRawTransaction(rawTransaction, attempt + 1);
    }
  }

  async getTransactionFromBlock(hashStringOrNumber, index, attempt = 0) {
    try {
      //await this.initWSConnect();
      const transaction = await this.web3.eth.getTransactionFromBlock(
        hashStringOrNumber,
        index
      );
      return transaction;
    } catch (ex) {
      console.log("ex ", ex);
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getTransactionFromBlock(
        hashStringOrNumber,
        index,
        attempt + 1
      );
    }
  }

  async getLatestBlockHeight(attempt = 0) {
    try {
      // await this.initWSConnect();
      const number = await this.web3.eth.getBlockNumber();
      if (!number) {
        const sync = await this.web3.eth.isSyncing();
        if (sync) {
          return sync.currentBlock;
        }
        return 0;
      }
      return number;
    } catch (ex) {
      console.log("ex ", ex);
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getLatestBlockHeight(attempt + 1);
    }
  }

  async broadcast(hex, attempt = 0) {
    try {
      //await this.initWSConnect();
      console.log("hex", hex);
      const data = await this.web3.eth.sendSignedTransaction(`0x${hex}`);
      return data;
    } catch (ex) {
      console.log("ex", ex);
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.broadcast(hex, attempt + 1);
    }
  }

  async getBalance(address, attempt = 0) {
    try {
      //await this.initWSConnect();
      const balance = await this.web3.eth.getBalance(address);
      return balance;
    } catch (ex) {
      console.log("ex ", ex);
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getBalance(address, attempt + 1);
    }
  }

  async reconnect(attempt = 0) {
    try {
      await Promise.delay(1000 * this.sleepTime);
      var provider = new Web3.providers.WebsocketProvider(this.nodeUrl);
      provider.on("connect", async function() {
        console.log("WSS Reconnected");
        this.web3 = new Web3(provider);
        return;
      });
    } catch (ex) {
      console.log("ex :", ex);
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      await this.reconnect(attempt + 1);
    }
  }

  async getNonce(address, attempt = 0) {
    try {
      const nonce = await this.web3.eth.getTransactionCount(address);
      return nonce;
    } catch (ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getNonce(address, attempt + 1);
    }
  }
}

module.exports = EthereumApi;
