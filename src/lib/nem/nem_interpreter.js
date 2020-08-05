const Promise = require('bluebird');
const utils = require('../../utils');
const Decimal = require('decimal.js');
const constants = require('./nem_constants');
const nem = require('nem-sdk').default;

class NemInterpreter {
    constructor({
        address,
        nemApi,
        NEM_ITEM_PER_PAGE,
    }) {
        // Global
        this.addresses = address;

        // Local
        this.api = nemApi;
        this.currency = constants.CURRENCY;
        this.itemPerPage = Number(NEM_ITEM_PER_PAGE);
    }


    async getMeta(transactions) {
        let meta = []
        await Promise.each(transactions, async (transaction) => {
            var addressAndMemo = utils.splitAddressAndMemo(transaction.address);
            var to_address = addressAndMemo.address
            var memo = addressAndMemo.memo
            var amount = transaction.amount
            meta.push({ to_address, amount, memo })
        })
        return meta
    }

    async derive(wallet, path) {
        const { settlementAddress: address } = wallet;
        const memo = path === this.addresses.path.SETTLEMENT
            ? null // Settlement has no memo
            : utils.generateMemo(path)
        return { address, memo };
    }

    async deriveColdAddress(wallet, path) {
        const { coldSettlementAddress: address } = wallet;
        const memo = (path === this.addresses.path.SETTLEMENT || path === this.addresses.path.COLDWALLET)
            ? null
            : utils.generateMemo(path)
        return { address, memo };
    }

    async buildBroadcastedWithdrawals(rawTransaction, response, transaction) {
        console.log('*--- NEM_interpreter.buildBroadcastedWithdrawals ---*')
        // From response
        const transactionHash = response.transactionHash.data;
        // Constant
        const outputIndex = 0;
        const currency = constants.CURRENCY;

        const amount = transaction.amount;
        const toAddress = transaction.to_address
        const withdrawal = { currency, outputIndex, transactionHash, amount, toAddress };
        return [withdrawal]; // We have only 1 withdrawal per broadcasted transaction
    }

    buildInputWithdrawals(transaction) {
        return [];
    }

    // Broadcast
    async deserializeTx(raw) {
        console.log('*---- Nem_interpreter.deserializeTx ----*')
        const rawTx = await this.api.decodeRawTransaction(raw);
        console.log('rawTx:', rawTx)
        return rawTx
    }

    // Monitor
    async parseAddress(address, memo, trx) {
        console.log('*---- Nem_interpreter.parseAddress ----*')
        const found = (
            // If this has memo
            memo &&
            // Then we lookup as user address first
            await this.addresses
                .findByAddressAndMemoAndService(constants.NAME, address, memo, trx)
        ) ||
            await this.addresses.findSettlement(constants.NAME, address, trx);

        return found && {
            ...found,
            fullAddress: await utils.formatAddressWithMemo(found),
        };
    }

    async parseTransaction(raw, blockHeight, trx) {
        console.log('*---- Nem_interpreter.parseTransaction ----*')
        const transaction = await this.buildTransferTransaction(raw, trx);
        const transactionHash =
            // Normal transaction
            raw.hash
        return [{
            ...transaction,
            blockHeight,
            outputIndex: 0,
            transactionHash,
            currency: constants.CURRENCY,
            feeCurrency: constants.FEE_CURRENCY,
        }];
    }

    async buildTransferTransaction(data, trx) {
        console.log('*---- Nem_interpreter.buildTransferTransaction ----*')
        console.log('data:', data)
        return {  // Sender & Receiver
            to: data.toAddr,
            from: data.fromAddr,
            toAddress: await this.parseAddress(data.toAddr, data.memo, trx),
            fromAddress: await this.parseAddress(data.fromAddr, null, trx),
            amount: data.value,
        };
    }

    getCurrencyOfOperation(op) {
        return (op.asset_type === constants.ASSET_TYPE_NATIVE || !op.asset_code)
            ? constants.CURRENCY // XLM is native
            : op.asset_code;
    }

    async getAllTransactionOperations(hash, previous = null) {
        console.log('*---- Nem_interpreter.getAllTransactionOperations ----*')
        const current = previous
            ? await previous.next()
            : await this.api.findOperationsByTransaction(hash, this.itemPerPage, 'asc');
        if (current.records.length < this.itemPerPage) return current.records;
        return current.records.concat(await this.getAllTransactionOperations(null, current));
    }

    parseRawTransaction(rawTx) {
        console.log('*---- NEM_interpreter.parseRawTransaction ----*')
        return {
            height: parseInt(rawTx.meta.height),
            hash: rawTx.meta.hash.data,
            // Get address from public key of sender
            fromAddr: nem.model.address.toAddress(rawTx.transaction.signer, nem.model.network.data.mainnet.id),
            toAddr: rawTx.transaction.recipient,
            value: parseFloat((rawTx.transaction.amount / constants.XEM_TO_MICROXEMS).toFixed(6)),
            // txAsset: rawTx.txAsset,
            memo: rawTx.transaction.message.payload ? Buffer.from(rawTx.transaction.message.payload, 'hex').toString() : ''
        }
    }
}

module.exports = NemInterpreter;
