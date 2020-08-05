const Promise = require('bluebird');
const Monitor = require('../monitor');
const constants = require('./nem_constants');

class NemMonitor extends Monitor {
    constructor({
        db,
        block,
        token,
        wallet,
        funding,
        withdrawal,
        failedApi,
        limit,
        nemApi: api,
        NEM_ITEM_PER_PAGE,
        NEM_SLEEP_TIME: sleepTime,
        nemInterpreter: interpreter,
        NEM_START_BLOCK_HEIGHT: startBlockHeight,
        NEM_MINIMUM_CONFIRMATION: minimumConfirmation,
    }) {
        const { NAME: name } = constants;
        super({
            db,
            api,
            name,
            block,
            token,
            interpreter,
            funding,
            withdrawal,
            failedApi,
            limit,
            sleepTime,
            startBlockHeight,
            minimumConfirmation,
        });
        // Native currency only
        this.currency = constants.CURRENCY;
        this.itemPerPage = Number(NEM_ITEM_PER_PAGE);
        this.wallets = wallet;
    }

    async getAllAddressTransactions(address, startHeight, id = 0) {
        console.log('*---- NEM_Monitor.getAllAddressTransactions ----*')
        var records = await this.api.findTransactionsByAddress(address, id);
        if (records.length) {
            // Reverse the array in ascending order of height
            records.reverse();
            var [minBlock, maxBlock] = [0, records.length - 1].map(index => records[index]);
            if (records.length == this.itemPerPage) {
                if (records[0].meta.height > startHeight) {
                    var nextRecords = [];
                    nextRecords = await this.getAllAddressTransactions(address, startHeight, records[0].meta.id);
                    console.log('nextRecords:', nextRecords)
                    return [...nextRecords, ...records];
                } else {
                    return [...records]
                }
            }
            return [...records]
        }
        return [];
    }

    filterSupportedCurrencyTransactions(transactions) {
        console.log('*---- Nem_monitor.filterSupportedCurrencyTransactions ----*')
        return transactions
            .filter(transaction =>
                transaction.currency === this.currency ||
                this.tokens.isEnabled(
                    this.name,
                    transaction.currency,
                    transaction.contractAddress,
                ));
    }

    async buildTxsMap(fromHeight, toHeight) {
        console.log('*---- Nem_monitor.buildTxsMap ----*')
        // get all settlement addresses to etch
        const wallets = await this.wallets.findAllByService(this.name);
        const addresses = wallets.map(address => address.settlementAddress);
        // Fetch transactions off all addresses
        // Use txsMap to keep only one tx from all with same hash
        // Use blocksMap to collect txs with same height
        const txsMap = new Map();
        await Promise.each(
            addresses,
            async address => (await this.getAllAddressTransactions(address, fromHeight))
                .map(this.interpreter.parseRawTransaction)
                .filter(tx => tx.height >= fromHeight && tx.height <= toHeight)
                .forEach(tx => txsMap.set(tx.hash, tx)),
        );
        return txsMap;
    }

    async buildBlocksMap(txsMap, fromHeight, toHeight) {
        console.log('*---- Nem_monitor.buildBlocksMap ----*')
        const blocksMap = new Map();
        txsMap.forEach(tx => blocksMap.set(
            tx.height,
            (blocksMap.get(tx.height) || []).concat(tx),
        ));

        // Set a virtual block for height = toHeight
        // Because there is no transactions there
        if (!blocksMap.get(toHeight)) blocksMap.set(toHeight, []);
        return blocksMap;
    }

    async fetchRange(fromHeight, toHeight) {
        console.log('*---- Nem_monitor.fetchRange ----*')
        const txsMap = await this.buildTxsMap(fromHeight, toHeight);
        // console.log("txsMap",txsMap);
        const blocksMap = await this.buildBlocksMap(txsMap, fromHeight, toHeight);
        console.log('blocksMap:', blocksMap)
        await Promise.each(
            Array.from(blocksMap.keys()).sort(),
            async (height) => {
                const rawTransactions = blocksMap.get(height);
                const transactions = [];
                await Promise.each(
                    rawTransactions,
                    async rawTx => transactions
                        .push(...await this.interpreter.parseTransaction(rawTx, height)),
                );
                this.nextBlocks.push({ height, transactions });

            },
        );
    }
}

module.exports = NemMonitor;
