const { arrayToMap } = require('../../utils');
const HdKey = require('@ont-community/hdkey-secp256r1');
const ontology = require('ontology-ts-sdk');
const Decimal = require('decimal.js');
const Promise = require('bluebird');

const { OntAssetTxBuilder, Crypto, utils } = ontology;
const { Address, PublicKey } = Crypto;

class OntologyInterpreter {
  constructor({
    address,
    funding,
    token,
    ontologyConstants,
    ontologyApi,
    ONTOLOGY_GAS_PRICE,
    ONTOLOGY_GAS_LIMIT
  }) {
    this.addresses = address;
    this.fundings = funding;
    this.tokens = token;
    this.constants = ontologyConstants;
    this.api = ontologyApi;
    this.gasPrice = Number(ONTOLOGY_GAS_PRICE)
    this.gasLimit = Number(ONTOLOGY_GAS_LIMIT)
  }

  async parseTransactions(service, rawTxs, blockHeight, trx) {
    console.log('*---- ONT_interpreter.parseTransactions ----*')
    const filteredTxs = this.parseTransfers(rawTxs);

    const fromAddressHashes = filteredTxs.map(tx => tx.from);
    const fromAddresses = await this.addresses.findAllByHashes(service, fromAddressHashes, trx);
    const fromAddressMap = arrayToMap(fromAddresses, { keys: ['address'] });

    const toAddressHashes = filteredTxs.map(tx => tx.to);
    const toAddresses = await this.addresses.findAllByHashes(service, toAddressHashes, trx);
    const toAddressMap = arrayToMap(toAddresses, { keys: ['address'] });
    if (toAddresses.length || fromAddresses.length)
    {
      return filteredTxs.map(tx => ({
        ...tx,
        blockHeight,
        feeCurrency: this.constants.FEE_CURRENCY,
        feeAmount: this.constants.FEE_AMOUNT,
        fromAddress: fromAddressMap.get(tx.from),
        toAddress: toAddressMap.get(tx.to),
      }));
    } else {
      return []
    }
  }

  // A tx might have more than 2 transfer:
  // 1 is for fee transfer, the others are the actual transfers
  parseTransfers(rawTxs) {
    const txs = [];

    rawTxs.forEach((rawTx) => {
      let curOutputIndex = 0;
      const { State: state, TxHash: transactionHash } = rawTx;
      if (state !== 1) return;

      rawTx.Notify.forEach((txData, index) => {
        // Skip the last data since it's fee
        if (index === rawTx.Notify.length - 1) return;

        const tx = this.parseTransfer(transactionHash, curOutputIndex, txData);

        if (tx) {
          txs.push(tx);
          curOutputIndex += 1;
        }
      });
    });

    return txs;
  }

  parseTransfer(transactionHash, outputIndex, txData) {
    console.log('*---- ONT_interpreter.parseTransfer ----*')
    const { ContractAddress, States } = txData;
    const [type, from, to, amount = 0] = States;

    if (type !== 'transfer') return undefined;

    const tx = { transactionHash, to, from, outputIndex, amount };
    tx.state = this.fundings.state.CONFIRMED;

    const { ONG_CONTRACT_ADDRESS, ONT_CONTRACT_ADDRESS } = this.constants;

    switch (ContractAddress) {
      case ONT_CONTRACT_ADDRESS: 
        tx.currency = 'ONT';
        tx.contractAddress = ONT_CONTRACT_ADDRESS;
        return tx;
      case ONG_CONTRACT_ADDRESS:
        tx.currency = 'ONG';
        tx.amount = new Decimal(amount).div(this.constants.FEE_CURRENCY_DECIMAL).toFixed();
        tx.contractAddress = ONG_CONTRACT_ADDRESS;
        if (tx.amount > this.constants.ONG_MIN_DEPOSIT) {
          return tx;
        }
    }
    // if (ContractAddress === ONG_CONTRACT_ADDRESS) {
    //   tx.currency = 'ONG';
    //   tx.amount = new Decimal(amount).div(this.constants.FEE_CURRENCY_DECIMAL).toFixed();
    //   tx.contractAddress = ONG_CONTRACT_ADDRESS;
    //   return tx;
    // } else if (ContractAddress === ONT_CONTRACT_ADDRESS) {
    //   tx.currency = 'ONT';
    //   return tx;
    // }

    // if (ContractAddress === ONT_CONTRACT_ADDRESS) {
    //   tx.currency = 'ONT';
    //   return tx;
    // }

    return undefined;
  }

  async deserializeTx(raw) {
    const ontTx = OntAssetTxBuilder.deserializeTransferTx(raw);
    const txHash = utils.reverseHex(ontTx.getHash());

    return {
      transactionHash: txHash,
      amount: ontTx.amount,
      currency: ontTx.tokenType,
      toAddress: ontTx.to.toBase58(),
      outputIndex: 0,
    };
  }

  buildBroadcastedWithdrawals(transaction) {
    return [transaction];
  }

  async derive(wallet, path) {
    console.log('*---- ONT_interpreter.derive ----*')
    const hdKey = HdKey.fromExtendedKey(wallet.xpubs);
    const { publicKey } = hdKey.derive(`m/${path}`);

    // Need to convert raw public key to ONT public key
    // in order to generate ONT address
    const ontPublicKey = new PublicKey(publicKey.toString('hex'));
    const address = Address.fromPubKey(ontPublicKey).toBase58();

    return { address };
  }

  async deriveColdAddress(wallet, path) {
    const hdKey = HdKey.fromExtendedKey(wallet.xpubsColdWallets);
    const { publicKey } = hdKey.derive(`m/${path}`);

    // Need to convert raw public key to ONT public key
    // in order to generate ONT address
    const ontPublicKey = new PublicKey(publicKey.toString('hex'));
    const address = Address.fromPubKey(ontPublicKey).toBase58();

    return { address };
  }

  async getMeta(token) {
    console.log('*---- ONT_interpreter.getMeta ---*')
    let meta = [];
    meta.push({
      "gasPrice": this.gasPrice,
      "gasLimit": this.gasLimit,
      "decimals": token.decimals
      })
    console.log('meta:',meta)
    return meta;
  }

  buildInputWithdrawals(transaction) {
    return [];
  }
}

module.exports = OntologyInterpreter;
