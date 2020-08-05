const Promise = require('bluebird');
const utils = require('../../utils');
const Decimal = require('decimal.js');
const constants = require('./cosmos_constants');

class CosmosInterpreter {
    constructor({
        address,
        cosmosApi,
        COSMOS_ITEM_PER_PAGE,
    }) {
        // Global
        this.addresses = address;

        // Local
        this.api = cosmosApi;
        this.currency = constants.CURRENCY;
        this.itemPerPage = Number(COSMOS_ITEM_PER_PAGE);
    }

    async getMeta(wallet, transactions, isColdWallet = true) {
        // ------> Expected meta <------ 
        // {
        // 	msgs: [
        // 		{
        // 			type: "cosmos-sdk/MsgSend",
        // 			value: {
        // 				amount: [
        // 					{
        // 						amount: String(100000), 	// 6 decimal places (1000000 uatom = 1 ATOM)
        // 						denom: "uatom"
        // 					}
        // 				],
        // 				from_address: address,
        // 				to_address: "cosmos18vhdczjut44gpsy804crfhnd5nq003nz0nf20v"
        // 			}
        // 		}
        // 	],
        // 	chain_id: chainId,
        // 	fee: { amount: [ { amount: String(5000), denom: "uatom" } ], gas: String(200000) },
        // 	memo: "",
        // 	account_number: String(data.result.value.account_number),
        // 	sequence: String(data.result.value.sequence)
        // }
        let meta = []
        const type = constants.TYPE_TRANSACTION
        const chain_id = constants.CHAIN_ID
        const fee = constants.FEE
        let from_address = ''
        if (isColdWallet) {
            from_address = wallet.settlementAddress
        } else {
            from_address = wallet.coldSettlementAddress
        }
        const account = await this.api.getAccountInfo(from_address);
        console.log('account:', account)
        var account_number = account.value.account_number
        var sequence = account.value.sequence
        await Promise.each(transactions, async (transaction, index) => {
            let msgs = []
            let amount = [{ amount: String(transaction.amount * constants.ATOM_TO_UATOM), denom: constants.FEE_CURRENCY }]
            var addressAndMemo = utils.splitAddressAndMemo(transaction.address);
            var to_address = addressAndMemo.address
            let value = { amount, from_address, to_address }
            msgs.push({ type, value })
            var memo = addressAndMemo.memo
            sequence = String(parseInt(sequence) + index);
            meta.push({ msgs, chain_id, fee, memo, account_number, sequence })
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

    buildBroadcastedWithdrawals(rawTransaction, response) {
        // From response
        const { txhash: transactionHash } = response;
        // Constant
        const outputIndex = 0;
        const currency = constants.CURRENCY;

        const amount = parseInt(rawTransaction.tx.msg[0].value.amount[0].amount) / constants.ATOM_TO_UATOM
        const toAddress = rawTransaction.tx.msg[0].value.to_address
        const withdrawal = { currency, outputIndex, transactionHash, amount, toAddress };
        return [withdrawal]; // We have only 1 withdrawal per broadcasted transaction
    }

    buildInputWithdrawals(transaction) {
        return [];
    }

    // Broadcast
    async deserializeTx(raw) {
        console.log('*---- Cosmos_interpreter.deserializeTx ----*')
        const rawTx = await this.api.decodeRawTransaction(raw);
        console.log('rawTx:', rawTx)
        return rawTx
    }

    // Monitor
    async parseAddress(address, memo, trx) {
        console.log('*---- Cosmos_interpreter.parseAddress ----*')
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
        console.log('*---- COSMOS_interpreter.parseTransaction ----*')
        const transaction = await this.buildTransferTransaction(raw, trx);
        // console.log('raw:',raw)
        // console.log('transaction:',transaction)
        // console.log('blockHeight:',blockHeight)
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
        console.log('*---- COSMOS_interpreter.buildTransferTransaction ----*')
        // console.log("data",data);
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
        console.log('*---- Cosmos_interpreter.getAllTransactionOperations ----*')
        const current = previous
            ? await previous.next()
            : await this.api.findOperationsByTransaction(hash, this.itemPerPage, 'asc');
        if (current.records.length < this.itemPerPage) return current.records;
        return current.records.concat(await this.getAllTransactionOperations(null, current));
    }

    parseRawTransaction(rawTx) {
        console.log('*---- Cosmos_interpreter.parseRawTransaction ----*')
        // console.log('raw:',rawTx)
        var value = 0;
        if (rawTx.tx.value.msg[0].value.amount[0].denom == constants.FEE_CURRENCY) {
            value = rawTx.tx.value.msg[0].value.amount[0].amount
        }
        return {
            height: parseInt(rawTx.height),
            hash: rawTx.txhash,
            fromAddr: rawTx.tx.value.msg[0].value.from_address,
            toAddr: rawTx.tx.value.msg[0].value.to_address,
            value: parseFloat((parseInt(value) / constants.ATOM_TO_UATOM).toFixed(6)),
            txAsset: rawTx.txAsset,
            memo: rawTx.tx.value.memo,
        };
    }
}

module.exports = CosmosInterpreter;
