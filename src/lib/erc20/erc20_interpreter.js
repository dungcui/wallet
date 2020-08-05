const constants = require("./erc20_constants");
// const smart_contract = require('./erc20_contract');
const HdKey = require("ethereumjs-wallet/hdkey");
const erc20Api = require("./erc20_rpc");
const Web3 = require("web3");
const ERC20_NODE_URL = process.env.ERC20_NODE_URL;
const web3 = new Web3(new Web3.providers.WebsocketProvider(ERC20_NODE_URL));
const ABI = require("./erc20_ABI");
const utils = require("./erc20_utils");
const Decimal = require("decimal.js");

// const canoeSolidity = require('canoe-solidity');

class Erc20Interpreter {
  constructor({ address, funding, erc20Rpc, erc20Contract, token }) {
    this.addresses = address;
    this.smart_contract = erc20Contract;
    this.fundings = funding;
    this.api = new erc20Api(web3);
    this.tokens = token;
    this.name = constants.NAME;
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
    // const amount = web3.utils.fromWei(new web3.utils.BN(transaction.value), 'gwei').toString();
    let feeAmount = web3.utils
      .toBN(transaction.gas)
      .mul(web3.utils.toBN(transaction.gasPrice));
    feeAmount = web3.utils
      .fromWei(new web3.utils.BN(feeAmount), "gwei")
      .toString();
    const receivedAddress = transaction.to
      ? transaction.to.toLowerCase()
      : "na";
    const smartContract = await this.tokens.findContractByAddressAndService(
      this.name,
      receivedAddress,
      trx
    );
    let result = null;
    let token = "";
    let amount = 0;
    let address = "";
    let contractAddress = "";
    result = utils.decodeFunctionArgs(ABI.abi, transaction.input);

    if (
      transaction.hash ===
      "0x3d0b06cd4fb8a587d456ba1efd8b107c951a5e5d9f735e26eb0a7c8c895fc262"
    ) {
      console.log("result :", result);
      console.log(" result[result.length] ", result[result.length]);
      console.log("result[result.length] ", result[result.length]);
      console.log(
        "result[result.length] ",
        result[result.length] === "sendMultiSigToken"
      );
      console.log("result[2] ", result[2]);
      console.log(
        " result[2].name ",
        result[2].name === "tokenContractAddress"
      );
    }
    if (
      result &&
      result[result.length - 1] &&
      result[result.length - 1].function === "sendMultiSigToken" &&
      result[2] &&
      result[2].name === "tokenContractAddress"
    ) {
      const contractAddressToCheck = "0x" + result[2].data;
      console.log("contractAddress :", contractAddress);
      const smartContractSendMultiSig = await this.tokens.findContractByAddressAndService(
        this.name,
        contractAddressToCheck,
        trx
      );
      if (
        smartContractSendMultiSig &&
        result[0] &&
        result[1] &&
        result[0].name === "toAddress" &&
        result[1].name === "value"
      ) {
        if (
          transaction.hash ===
          "0x3d0b06cd4fb8a587d456ba1efd8b107c951a5e5d9f735e26eb0a7c8c895fc262"
        ) {
          console.log("smartContractSendMultiSig :", smartContractSendMultiSig);
          console.log("transaction", transaction);
          console.log("address", address);
          const find = await this.addresses.findByAddressHashWithLowerCase(
            this.name,
            address.toLowerCase(),
            trx
          );
          console.log("find", find);
          const status = await this.api.getTransactionReceipt(transaction.hash);
          console.log("status", status);
        }
        address = "0x" + result[0].data;
        amount = new Decimal(result[1].data)
          .div(Math.pow(10, smartContractSendMultiSig.decimals))
          .toString();
        token = smartContractSendMultiSig.currency;
        contractAddress = smartContractSendMultiSig.address;
        console.log("address :", address);
      }
    } else if (smartContract) {
      // console.log(smartContract);
      // console.log("result" ,result)
      token = smartContract.currency;
      contractAddress = smartContract.address;
      if (result) {
        try {
          if (
            result[0].name === "from" &&
            result[1].name === "to" &&
            result[2].name === "value"
          ) {
            address = "0x" + result[1].data;
            amount = new Decimal(result[2].data)
              .div(Math.pow(10, smartContract.decimals))
              .toString();
          } else if (result[0].name === "to" && result[1].name === "value") {
            address = "0x" + result[0].data;
            amount = new Decimal(result[1].data)
              .div(Math.pow(10, smartContract.decimals))
              .toString();
          }
        } catch (err) {
          console.log("err", result);
          console.log("txbug", transaction.hash);
        }
      }
    } else {
      if (transaction.to) address = transaction.to;
      token = "ETHEREUM";
      amount = new Decimal(
        web3.utils.fromWei(new web3.utils.BN(transaction.value), "gwei")
      )
        .div(1000000000)
        .toString();
      let feeAmount = web3.utils
        .toBN(transaction.gas)
        .mul(web3.utils.toBN(transaction.gasPrice));
      feeAmount = web3.utils
        .fromWei(new web3.utils.BN(feeAmount), "gwei")
        .toString();
    }

    let findAddress = null;
    if (address && address != "") {
      findAddress = await this.addresses.findByAddressHashWithLowerCase(
        this.name,
        address.toLowerCase(),
        trx
      );
    }
    return {
      ...transaction,
      blockHeight,
      outputIndex: 0,
      currency: token,
      contractAddress: contractAddress,
      feeCurrency: constants.FEE_CURRENCY,
      transactionHash: transaction.hash,
      fromAddress:
        (await this.addresses.findByAddressHash(transaction.from, trx)) || null,
      toAddress: findAddress || null,
      amount,
      feeAmount
    };
  }

  async buildBroadcastedWithdrawals(transaction, response) {
    const tx = await this.api.getRawTx(response.transactionHash);

    const receivedAddress = tx.to ? tx.to.toLowerCase() : "na";
    const smartContract = await this.tokens.findContractByAddressAndService(
      this.name,
      receivedAddress
    );

    let result = utils.decodeFunctionArgs(ABI.abi, tx.input);
    let address = "";
    let amount = 0;
    try {
      if (
        result[0].name === "from" &&
        result[1].name === "to" &&
        result[2].name === "value"
      ) {
        address = "0x" + result[1].data;
        amount = new Decimal(result[2].data)
          .div(Math.pow(10, smartContract.decimals))
          .toString();
      } else if (result[0].name === "to" && result[1].name === "value") {
        address = "0x" + result[0].data;
        amount = new Decimal(result[1].data)
          .div(Math.pow(10, smartContract.decimals))
          .toString();
      }
    } catch (err) {
      console.log("err", err);
      console.log("txbug", transaction.hash);
    }
    return [
      {
        amount: amount,
        currency: constants.CURRENCY,
        toAddress: address,
        outputIndex: tx.transactionIndex,
        transactionHash: response.transactionHash
      }
    ];
  }

  buildInputWithdrawals(transaction) {
    return [];
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

  async getMeta(wallet) {
    return { walletId: wallet.id };
  }
}

module.exports = Erc20Interpreter;
