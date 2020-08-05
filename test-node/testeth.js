
const jayson = require('jayson');
const Promise = require('bluebird');
const Web3 = require('web3');



    const nodeUrl = "http://95.216.227.169:8545";
    if (!nodeUrl) {
      throw Error('Please provide ETHEREUM_NODE_URL');
    }
    const web3 = new Web3();
    web3.setProvider(new Web3.providers.HttpProvider(nodeUrl));
    const client = Promise.promisifyAll(jayson.client.http(nodeUrl));
  


  async function ethCall(object, block = 'latest') {
    return (await client.requestAsync('eth_call', [object, block])).result;
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
    const transaction = await web3.eth.getTransactionFromBlock(hashStringOrNumber, index);
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


  getLatestBlockHeight().then(block => 
    {
        
        console.log(JSON.stringify(block))
    });