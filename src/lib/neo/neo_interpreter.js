const Promise = require('bluebird');
const constants = require('./neo_constants');
const Neon = require("@cityofzion/neon-js");

class NeoInterpreter {
  constructor({ address, funding, neoApi, neoContract, token }) {
    this.addresses = address;
    this.fundings = funding;
    this.api = neoApi;
    this.smart_contract = neoContract;
    this.tokens = token;
  }

  async derive(wallet, hdPath) {
    console.log("Neo derive addr...");
    // [params] number of address return default 0 or blank
    // id default 1
    const address = await this.api.getNewAddress("", 1);
    console.log("Neo get new address", address);
    return { address };
  }

  parseRawTransaction(block) {
    return {
      height: block.index,
      hash: block.hash,
      ...block.tx,
    };
  }

  async parseTransaction(transaction, blockHeight, trx) {
    // to, to address
    let inputs = null;
    const vin = transaction.vin.filter(inp => inp.txid && inp.vout >= 0);
    const [input] = vin;
    const isWithdrawal = input && 
      (await this.fundings.find(constants.NAME, input.txid, input.vout, trx));
    
    if (isWithdrawal) {
      // ...
      inputs = await Promise.map(transaction.vin, async inp => ({
        ...inp,
        transactionHash: inp.txid,
        outputIndex: inp.vout,
      }));
    }

    const outputs = [];
    // parse vout
    await Promise.each(transaction.vout, async(out) => {
      const { n, value: value } = out;
      const address = out.address;
     
      
      const smartContract = (await this.tokens.findContractByAddressAndService(
        constants.NAME, 
        out.asset.substring(2), //without 0x 
      )) || null ;

      if(address ==="Abvbj1Ku14Lmibxuqi9WiT43SM3uhDHtVS")
      {
        console.log(smartContract);
      }

      const smartContractAddress = (typeof smartContract === "undefined" 
        ? null 
        : smartContract.address
      );
      //console.log(smartContract);
      if(smartContract)
      outputs.push({
        inputs,
        blockHeight,
        height: blockHeight,
        currency: smartContract.currency,
        feeCurrency: constants.FEE_CURRENCY,
        amount: value ,
        to: address,
        toAddress: (await this.addresses.findByAddressHash(address, trx)) || null,
        transactionHash: transaction.txid,
        outputIndex: n,
        script: transaction.scripts[0].verification,
        contractAddress: smartContractAddress,
        service: constants.NAME
      });
    });
    
    return outputs;
  }
 
  buildBroadcastedWithdrawals(currency,txid) {
    // const { txid: transactionHash, vout } = transaction;
    return {
      // amount: out.value * constants.BTC_TO_SATOSHI,
      currency: currency,
      outputIndex: 0,
      transactionHash:txid,
    };
  }

  buildInputWithdrawals(transaction) {
    return [];
  }

  async deserializeTx(raw) {
    const rawTx = raw.txid
    // return {
    //   transactionHash: rawTx.txid,
    //   ...rawTx,
    // };
    console.log('Neo_interpreter.DeserializeTx.rawTx:',rawTx);
    return rawTx;
  }

  async getMeta(wallet) {
    return { walletId: wallet.id };
  }
}

module.exports = NeoInterpreter;
