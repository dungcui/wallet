const constants = require("./etc_constants");
const HdKey = require("ethereumjs-wallet/hdkey");
const etcApi = require("./etc_api");
const Web3 = require("web3");
const ETC_NODE_URL = process.env.ETC_NODE_URL;
const web3 = new Web3(new Web3.providers.WebsocketProvider(ETC_NODE_URL));

class EtcInterpreter {
  constructor({ address, funding }) {
    this.addresses = address;
    this.fundings = funding;
    this.api = new etcApi(web3);
  }

  async derive(wallet, hdPath) {
    const hdPubKey = HdKey.fromExtendedKey(wallet.xpubs);
    const path = hdPath.indexOf("m") > -1 ? hdPath : `m/${hdPath}`;
    const address = web3.utils.toChecksumAddress(
      hdPubKey
        .derivePath(path)
        .getWallet()
        .getAddressString()
    );
    return { address };
  }

  async deriveColdAddress(wallet, hdPath) {
    // const xpub = new HDPublicKey(wallet.xpubs);
    const hdPubKey = HdKey.fromExtendedKey(wallet.xpubsColdWallets);
    const path = hdPath.indexOf("m") > -1 ? hdPath : `m/${hdPath}`;
    const address = web3.utils.toChecksumAddress(
      hdPubKey
        .derivePath(path)
        .getWallet()
        .getAddressString()
    );
    return { address };
  }

  async parseTransaction(transaction, blockHeight, trx) {
    const amount = web3.utils
      .fromWei(new web3.utils.BN(transaction.value), "gwei")
      .toString();
    let feeAmount = web3.utils
      .toBN(transaction.gas)
      .mul(web3.utils.toBN(transaction.gasPrice));
    feeAmount = web3.utils
      .fromWei(new web3.utils.BN(feeAmount), "gwei")
      .toString();
    return {
      ...transaction,
      blockHeight,
      outputIndex: 0,
      currency: constants.CURRENCY,
      feeCurrency: constants.FEE_CURRENCY,
      transactionHash: transaction.hash,
      fromAddress:
        (await this.addresses.findByAddressAndService(
          constants.NAME,
          transaction.from,
          trx
        )) || null,
      toAddress:
        (await this.addresses.findByAddressAndService(
          constants.NAME,
          transaction.to,
          trx
        )) || null,
      amount,
      feeAmount
    };
  }

  buildBroadcastedWithdrawals(transaction) {
    return {
      amount: web3.utils.fromWei(transaction.value, "gwei"),
      currency: constants.CURRENCY,
      toAddress: transaction.to,
      outputIndex: transaction.outputIndex,
      transactionHash: transaction.transactionHash
    };
  }

  async deserializeTx(raw) {
    const rawTx = await this.api.decodeRawTransaction(`0x${raw}`);
    console.log("rawTx", rawTx);
    // const tx = await this.api.getRawTx(rawTx);
    // console.log('tx:',tx);
    return {
      // height: tx.blockNumber,
      // blockHash: tx.blockHash,
      // nonce: tx.nonce,
      // outputIndex: tx.transactionIndex,
      // to: tx.to,
      // value: tx.value,
      transactionHash: rawTx
    };
  }

  buildInputWithdrawals(transaction) {
    return [];
  }

  async getMeta(wallet) {
    return { walletId: wallet.id };
  }
}

module.exports = EtcInterpreter;
