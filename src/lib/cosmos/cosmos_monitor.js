const Promise = require('bluebird');
const Monitor = require('../monitor');
const constants = require('./cosmos_constants');

class CosmosMonitor extends Monitor {
    constructor({
        db,
        block,
        token,
        wallet,
        funding,
        withdrawal,
        failedApi,
        limit,
        cosmosApi: api,
        COSMOS_ITEM_PER_PAGE,
        COSMOS_SLEEP_TIME: sleepTime,
        cosmosInterpreter: interpreter,
        COSMOS_START_BLOCK_HEIGHT: startBlockHeight,
        COSMOS_MINIMUM_CONFIRMATION: minimumConfirmation,
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
        this.itemPerPage = Number(COSMOS_ITEM_PER_PAGE);
        this.wallets = wallet;
    }

    async getAllAddressTransactions(address, startHeight, page = 1, maxBlockHeight = 0) {
        console.log('*---- COSMOS_Monitor.getAllAddressTransactions ----*')
        const records = await this.api.findTransactionsByAddress(address, page, this.itemPerPage, startHeight);
        if (records.length) {
            const [minBlock, maxBlock] =
                [0, records.length - 1].map(index => records[index]);
            if (maxBlockHeight != parseInt(maxBlock.height)) {
                var nextRecords = [];
                maxBlockHeight = parseInt(maxBlock.height);
                if (records.length >= this.itemPerPage) {
                    nextRecords = await this.getAllAddressTransactions(address, startHeight, page + 1, maxBlockHeight);
                }
                // console.log('nextRecords:',nextRecords)
                return [...records, ...nextRecords];
            }
        }
        return [];
    }

    filterSupportedCurrencyTransactions(transactions) {
        console.log('*---- Cosmos_monitor.filterSupportedCurrencyTransactions ----*')
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
        console.log('*---- Cosmos_monitor.buildTxsMap ----*')
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
        console.log("txsMap", txsMap);
        return txsMap;
    }

    async buildBlocksMap(txsMap, fromHeight, toHeight) {
        console.log('*---- Cosmos_monitor.buildBlocksMap ----*')
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
        console.log('*---- Cosmos_monitor.fetchRange ----*')
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
        console.log('this.nextBlocks:', this.nextBlocks)
    }
}

module.exports = CosmosMonitor;
