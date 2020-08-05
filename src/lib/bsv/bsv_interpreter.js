// const { arrayToMap } = require('../../utils');
// const constants = require('./bsv_constants');
const { Address, HDPublicKey, Networks } = require('bitcore-lib');
const constants = require('./bsv_constants');
const Promise = require('bluebird');
const bchaddrjs = require('bchaddrjs');


class BsvInterpreter {
  constructor({ address, funding, bsvRpc }) {
    this.addresses = address;
    this.fundings = funding;
    this.api = bsvRpc;
  }

  async derive(wallet, path) {
    // const xpub = new HDPublicKey(wallet.xpubs);
    const xpub = new HDPublicKey(wallet.xpubs);
    const address = new Address(xpub.derive(`m/${path}`).publicKey, Networks.mainnet).toString();
    return { address };
  }

  async deriveColdAddress(wallet, path) {
    // const xpub = new HDPublicKey(wallet.xpubs);
    const xpub = new HDPublicKey(wallet.xpubsColdWallets);
    const address = new Address(xpub.derive(`m/${path}`).publicKey, Networks.mainnet).toString();
    return { address };
  }

  async parseTransaction(transaction, blockHeight, trx) {
    // to, to address
    let inputs = null;
    const vin = transaction.vin.filter(inp => inp.txid && inp.vout >= 0);
    const [input] = vin;
    const isWithdrawal =
      input && (await this.fundings.find(constants.NAME, input.txid, input.vout, trx));
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
    await Promise.each(transaction.vout, async (out) => {
      const { scriptPubKey, n, value: amount } = out;

      const { addresses } = scriptPubKey;
      let address = null;
      //let legacyAdress = null;
      let toAddress=(await this.addresses.findByAddressAndService("BSV",address, trx))
      //let text =null;
      //let bchaddress= null;
      if (addresses && addresses.length > 0) {
        [address] = addresses;
        if(address==="1N1p3QfCwZEkykk5tkBiKyUmYGjQ3CoZyW")
        {
          console.log("address",address);
          console.log("toAddress",toAddress);

        }
        // [text,bchaddress]=address.split(":")
        // legacyAdress = bchaddrjs.toLegacyAddress(bchaddress);
        outputs.push({
          inputs,
          blockHeight,
          height: blockHeight,
          currency: constants.CURRENCY,
          feeCurrency: constants.FEE_CURRENCY,
          amount: amount ,
          to: address,
          toAddress: (await this.addresses.findByAddressAndService("BSV",address, trx)) || null,
          transactionHash: transaction.txid,
          outputIndex: n,
          script: scriptPubKey.hex,
        });
      }
    });
    return outputs;
  }

  buildBroadcastedWithdrawals(transaction) {
    const { txid: transactionHash, vout } = transaction;
    return vout.map(out => ({
      amount: out.value * constants.BTC_TO_SATOSHI,
      currency: constants.CURRENCY,
      toAddress: out.scriptPubKey.addresses[0],
      outputIndex: out.n,
      transactionHash,
    }));
  }

  buildInputWithdrawals(transaction) {
    const { vin } = transaction;
    return vin.map(input => ({
      txid : input.txid,
      vout : input.vout,
    }));
  }

  async deserializeTx(raw) {
    const rawTx = await this.api.decodeRawTransaction(raw);
    return {
      transactionHash: rawTx.txid,
      ...rawTx,
    };
  }

  async getMeta(wallet) {
    return { walletId: wallet.id };
  }
}

module.exports = BsvInterpreter;
