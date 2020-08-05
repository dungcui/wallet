const jayson = require("jayson");
const Promise = require("bluebird");
const Web3 = require("web3");
const ABI = require("./erc20_ABI");

class Erc20Rpc {
  constructor(web3) {
    // this.nodeUrl = erc20NodeUrl;
    // if (!this.nodeUrl) {
    //   throw Error('Please provide ETHEREUM_NODE_URL');
    // }
    this.web3 = web3;
    this.sleepTime = 10;
    this.MAX_ATTEMPT = 20;
    // this.web3.setProvider(new Web3.providers.HttpProvider(this.nodeUrl));
    this.client = Promise.promisifyAll(jayson.client.http(this.nodeUrl));
  }

  async ethCall(object, block = "latest", attempt = 0) {
    try {
      await this.checkConnection();
      return (await this.web3.eth.call([object, block])).result;
    } catch (ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.web3.eth.call(object, (block = "latest"), attempt + 1);
    }
  }

  async getBlock(number, verbose = true, attempt = 0) {
    try {
      await this.checkConnection();
      const blockInfo = await this.web3.eth.getBlock(number, verbose);
      return blockInfo;
    } catch (ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getBlock(number, (verbose = true), attempt + 1);
    }
  }

  async getBlockHashByHeight(height, verbose = true, attempt = 0) {
    try {
      await this.checkConnection();
      const block = await this.web3.eth.getBlock(height, verbose);
      return block;
    } catch (ex) {
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
      await this.checkConnection();
      const transaction = await this.web3.eth.getTransaction(txHash);
      return transaction;
    } catch (ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getRawTx(txHash, attempt + 1);
    }
  }

  async getTransactionReceipt(txHash, attempt = 0) {
    try {
      await this.checkConnection();
      const transaction = await this.web3.eth.getTransactionReceipt(txHash);
      return transaction;
    } catch (ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getTransactionReceipt(txHash, attempt + 1);
    }
  }

  async decodeRawTransaction(rawTransaction, attempt = 0) {
    try {
      await this.checkConnection();
      return this.web3.utils.sha3(rawTransaction);
    } catch (ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.decodeRawTransaction(rawTransaction, attempt + 1);
    }
  }

  async getTransactionFromBlock(hashStringOrNumber, index, attempt = 0) {
    try {
      await this.checkConnection();
      const transaction = await this.web3.eth.getTransactionFromBlock(
        hashStringOrNumber,
        index
      );
      return transaction;
    } catch (ex) {
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
      await this.checkConnection();
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
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getLatestBlockHeight(attempt + 1);
    }
  }

  async broadcast(hex, attempt = 0) {
    try {
      await this.checkConnection();
      const data = await this.web3.eth.sendSignedTransaction(`0x${hex}`);
      return data;
    } catch (ex) {
      // console.log("ex :",ex);
      // if (attempt >= this.MAX_ATTEMPT) {
      throw Error(ex.message);
      // }
      // await Promise.delay(1000 * this.sleepTime);
      // return await this.broadcast(hex,attempt+1);
    }
  }

  async getBalance(contractAddress, address, attempt = 0) {
    try {
      await this.checkConnection();
      const contract = new this.web3.eth.Contract(ABI.abi, contractAddress);
      const balance = await contract.methods
        .balanceOf(address)
        .call((err, result) => {
          return result;
        });
      return balance;
    } catch (ex) {
      // if (attempt >= this.MAX_ATTEMPT) {
      console.log("ex ", ex); // }
      // await Promise.delay(1000 * this.sleepTime);
      // return await this.getBalance(contractAddress, address, attempt + 1);
    }
  }
  async getBalanceEth(address, attempt = 0) {
    try {
      await this.checkConnection();
      const balance = await this.web3.eth.getBalance(address);
      return balance;
    } catch (ex) {
      if (attempt >= this.MAX_ATTEMPT) {
        throw Error(`Failed after ${attempt} retries , exit.`);
      }
      await Promise.delay(1000 * this.sleepTime);
      return await this.getBalance(address, attempt + 1);
    }
  }

  async getNonce(address, attempt = 0) {
    try {
      await this.checkConnection();
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

  async checkConnection(attempt = 0) {
    try {
      // const connect = await this.web3.eth.net.isListening();
      // if (connect == true) return connect;
      // else {
      //   this.web3 = new Web3(
      //     new Web3.providers.WebsocketProvider("ws://95.216.227.169:8546")
      //   );
      return true;
      // }
    } catch (ex) {
      // if (attempt >= this.MAX_ATTEMPT) {
      //   throw Error(`Failed after ${attempt} retries , exit.`);
      // }
      // await Promise.delay(1000 * this.sleepTime);
      // return await this.checkConnection(attempt + 1);
    }
  }
}

module.exports = Erc20Rpc;
