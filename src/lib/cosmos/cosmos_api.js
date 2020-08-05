const Api = require('../api');
const Promise = require('bluebird');
const constants = require('./cosmos_constants');

class CosmosApi extends Api {
    constructor({
        cosmosNodeUrl, cosmosSleepTime, cosmosTimeout,
    }) {
        super({
            baseUrl: cosmosNodeUrl,
            sleepTime: Number(cosmosSleepTime),
            maxAttempt: 3,
            timeout: cosmosTimeout,
        });
        this.cosmosNodeUrl = cosmosNodeUrl
    }

    async getBlock(height) {
        return this.get(`/blocks/${height}`);
    }

    async getLatestBlockHeight() {
        const info = await (this.get('/blocks/latest'))
        return info.block_meta.header.height;
    }

    async getSequence(address) {
        const account = await this.getAccountInfo(address)
        return account.value.sequence
    }

    async getInfo() {
        const info = await (this.get('/node_info'))
        return info;
    }

    async getAccountInfo(address) {
        const accountInfo = await this.get(`/auth/accounts/${address}`)
        console.log('API.accountInfo:', accountInfo)
        return accountInfo.result;
    }

    async findTransactionsByAddress(address, page, itemPerPage) {
        console.log('*---- Cosmos_api.findTransactionsByAddress ----*')
        const transactions = await this.get(`txs?message.action=send&transfer.recipient=${address}&page=${page}&limit=${itemPerPage}`);
        console.log('transactions:', transactions)
        return transactions.txs;
    }

    async validateAddress(address) {
        try {
            const accountInfo = await this.getAccountInfo(address)
            if (accountInfo)
                return true;
            else
                return false;
        }
        catch (err) {
            return false;
        }
    }

    async decodeRawTransaction(rawTransaction) {
        const encode = await this.post('/txs/encode', rawTransaction);
        return encode.tx;
    }

    async getBalance(address) {
        console.log('CosmosAPI.getBalance')
        // 1 atom = 1.000.000 uatom
        const balances = await this.get(`/bank/balances/${address}`);
        var balanceAtom = 0;
        balances.result.forEach(async (balance) => {
            if (balance.denom == "uatom") {
                balanceAtom = (balance.amount / constants.ATOM_TO_UATOM)
            }
        })
        return balanceAtom
    }

    async broadcast(rawTransaction) {
        console.log('COSMOS_API.broadcast')
        const broadcast = await this.post('/txs', rawTransaction);
        return broadcast;
    }

}

module.exports = CosmosApi;
