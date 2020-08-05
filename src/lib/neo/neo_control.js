var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};

const main_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};

var fill_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};

var _ = require("lodash");
const api = require('@cityofzion/neon-js').api;
const wallet = require('@cityofzion/neon-js').wallet;
const tx = require('@cityofzion/neon-js').tx;
const constants = require('./neo_constants');

async function sendAsset(config) {
    console.log("sendAsset config:", config);
    return main_awaiter(this, void 0, void 0, function* () {
        return fillSigningFunction(config)
            .then(api.fillUrl)
            .then(api.fillBalance)
            .then(api.createContractTx)
            .then(addingIntents)
            .then(api.addAttributeIfExecutingAsSmartContract)
            .then(api.signTx)
            .then(api.addSignatureIfExecutingAsSmartContract)
            .then(sendTx)
            .catch((err) => {
                throw err;
            });
    });
}

// For sign offline
// async function sendAsset(config) {
//     console.log("sendAsset config:", config);
//     return main_awaiter(this, void 0, void 0, function* () {
//         return fillSigningFunction(config)
//             //.then(api.fillUrl)
//             .then(fillBalance)
//             .then(api.createContractTx)
//             .then(addingIntents)
//             .then(api.addAttributeIfExecutingAsSmartContract)
//             .then(api.signTx)
//             .then(api.addSignatureIfExecutingAsSmartContract)
//             .then(sendTx)
//             .catch((err) => {
//                 throw err;
//             });
//     });
// }

function fillSigningFunction(config) {
    return fill_awaiter(this, void 0, void 0, function* () {
        if (!config.signingFunction) {
            if (config.account) {
                console.log("key is", config.key);
                config.signingFunction = api.signWithPrivateKey(config.key);
            }
            else {
                throw new Error("No account found!");
            }
        }
        
        return config;
    });
}

function addingIntents(config) {
    const transactions = config.data;
    let transaction = config.tx;
    let arrCurrency = [];

    console.log("adding intents to trans", transactions);

    _.each(transactions, function (input, i) {
        let currency = constants.ASSET_SYMBOL["0x" + input.contractAddress];
        arrCurrency.push(currency);

        if (currency.toUpperCase() != "NEO" && currency.toUpperCase() != "GAS") {
            throw error("Currency is not valid.");
        }

        transaction.addIntent(currency, input.amount, input.address);
    });

    if (checkMultiCurrency(arrCurrency)) {
        throw error("Only 1 currency in transaction is accepted.");
    }

    transaction.calculate(config.balance);
    return config;
}

async function fillBalance(config) {
    config.balance = getBalance(config);
    return config;
}

function getBalance(config) {
    let total_unspent_amount = 0;
    let unspent_data = [];
    const _unspent = config.unspent;
    const transactions_data = config.data[0];

    _.each(_unspent, function (input, i) {
        let val = input["amount"];
        total_unspent_amount += val;
        unspent_data.push({
            value: val,
            txid: input["transactionHash"],
            n: input["outputIndex"]
        });
    });

    console.log("before get balance", config);
    console.log("--unspent data", unspent_data);
    console.log("--transactions data", transactions_data);

    const neoscanBalances = [{
        unspent: unspent_data,
        asset_symbol: transactions_data["currency"],
        asset_hash: constants.ASSET_ID[transactions_data["currency"]],
        asset: transactions_data["currency"],
        amount: total_unspent_amount
    }];

    const bal = new wallet.Balance({
        net: "",
        address: config.account.address
    });

    for (const b of neoscanBalances) {
        if (b.amount > 0 && b.unspent.length > 0) {
            bal.addAsset(b.asset, {
                unspent: parseUnspent(b.unspent)
            });
        }
        else {
            bal.addToken(b.asset, b.amount);
        }
    }

    console.log("after get balance", bal);
    return bal;
}

function parseUnspent(unspentArr) {
    return unspentArr.map(coin => {
        return {
            index: coin.n,
            txid: coin.txid,
            value: coin.value
        };
    });
}

function sendTx(config) {
    const rawTransaction = config.tx.serialize(true);
    console.log("serialize", rawTransaction)
    return [{ id: config.data[0].id, rawTx: rawTransaction }];
}

function checkMultiCurrency(input) {
    if (new Set(input).size > 1)
        return true;
    else
        return false;
}

module.exports = { sendAsset };