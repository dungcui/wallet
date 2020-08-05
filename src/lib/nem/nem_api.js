const Api = require('../api');
const Promise = require('bluebird');
const constants = require('./nem_constants');

class NemApi extends Api {
    constructor({
        nemNodeUrl, nemSleepTime, nemTimeout,
    }) {
        super({
            baseUrl: nemNodeUrl,
            sleepTime: Number(nemSleepTime),
            maxAttempt: 3,
            timeout: nemTimeout,
        });
        this.nemNodeUrl = nemNodeUrl
    }

    async getBlock(height) {
        const blockInfo = await this.post('/block/at/public', height);
        return blockInfo
    }

    async getLatestBlockHeight() {
        const info = await (this.get('/chain/height'))
        return info.height;
    }

    async getAccountInfo(address) {
        const accountInfo = await this.get(`/account/get?address=${address}`)
        return accountInfo;
    }

    async findTransactionsByAddress(address, id) {
        var transactions = {};
        if (id > 0) {
            transactions = await this.get(`/account/transfers/incoming?address=${address}&id=${id}`);
        } else {
            transactions = await this.get(`/account/transfers/incoming?address=${address}`);
        }
        return transactions.data;
    }

    async decodeRawTransaction(rawTransaction) {
        const decode = await this.get(`transaction/get?hash=${rawTransaction}`);
        return decode;
    }

    async getBalance(address) {
        // 1 xem = 1.000.000 microxems
        const accountInfo = await this.getAccountInfo(address)
        console.log('accountInfo:', accountInfo)
        var balance = 0;
        if (accountInfo) {
            balance = parseFloat((accountInfo.account.balance / constants.XEM_TO_MICROXEMS).toFixed(6));
        }
        return balance
    }

    async broadcast(rawTransaction) {
        const broadcast = await this.post('/transaction/announce', rawTransaction);
        return broadcast;
    }

}

module.exports = NemApi;
