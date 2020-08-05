const Service = require('../service.js');
const constants = require('./nem_constants');
const Promise = require('bluebird');
const utils = require('../../utils')
const nem = require('nem-sdk').default;

class NemService extends Service {
    constructor({
        db,
        block,
        token,
        wallet,
        address,
        funding,
        withdrawal,
        nemApi: api,
        nemInterpreter: interpreter,
    }) {
        const { NAME: name, CURRENCY: currency, FEE_CURRENCY: feeCurrency } = constants;
        const error = {
            ALREADY_HAS_WALLET: 'Already has wallet.',
            MISSING_SETTLEMENT_ADDRESS: 'Missing settlement address.',
            INVALID_SETTLEMENT_ADDRESS: 'Invalid settlement address.',
            NOT_ENOUGH_BALANCE: 'Currency is not enough for withdraw',
        };
        super({
            db,
            api,
            block,
            token,
            wallet,
            address,
            funding,
            withdrawal,

            name,
            error,
            currency,
            feeCurrency,
            interpreter,
        });
        this.NATIVE_ISSUER = constants.ASSET_TYPE_NATIVE;
    }

    async validateAddress(req) {
        const { hash, currency } = req;
        if (!hash) throw Error(this.error.MISSING_ADDRESS);
        try {
            const addressAndMemo = await utils.splitAddressAndMemo(hash)
            const validAddress = await nem.model.address.isValid(addressAndMemo.address);
            if (validAddress) {
                return { valid: true };
            } else {
                return { valid: false };
            }
        } catch (err) {
            console.log('err:', err)
            return { valid: false };
        }
    }

    async validateWallet(req) {
        const { settlementAddress } = req;
        if (!settlementAddress) {
            throw Error(this.error.MISSING_SETTLEMENT_ADDRESS);
        }
        const found = await this.wallets.findBySettlementAddress(this.name, settlementAddress);
        if (found) throw Error(this.error.ALREADY_HAS_WALLET);
        try {
            return await this.api.getAccountInfo(settlementAddress);
        } catch (err) {
            throw Error(this.error.INVALID_SETTLEMENT_ADDRESS);
        }
    }

    async bundleWithdrawal(req, isColdWallet = true) {
        const { walletId, transactions } = req;

        if (!transactions || transactions.length === 0) {
            throw Error(this.error.MISSING_TRANSACTIONS);
        }

        const wallet = await this.wallets.find(walletId);
        if (!wallet) throw Error(this.error.WALLET_NOT_FOUND);
        let sumWithDrawReq = 0;
        Promise.each(transactions, async transaction => {
            sumWithDrawReq += transaction.amount;
        })

        let balance = 0;
        if (!isColdWallet) {
            balance = await this.api.getBalance(wallet.settlementAddress);
        } else {
            balance = await this.api.getBalance(wallet.coldSettlementAddress);
        }

        if (balance < sumWithDrawReq)
            throw Error(this.error.NOT_ENOUGH_BALANCE);

        const payload = {
            type: this.bundleType.WITHDRAWAL,
            currency: this.currency,
            transactions: transactions,
            meta: await this.interpreter.getMeta(transactions),
        };

        console.log("Withdraw payload", JSON.stringify(payload));

        return { payload: JSON.stringify(payload) };
    }

    async broadcast(req) {
        // Read the payload
        const { payload } = req;
        if (!payload) throw Error(this.error.MISSING_PAYLOAD);

        const { transactionsHash: txsHash } = JSON.parse(payload);

        var successTxsHash = [];
        await Promise.each(txsHash, async (txHash) => {
            const { hash, externals, transaction } = txHash;
            // const transactionHash = await this.api.broadcast(hash);
            const transactionHash = await this.broadcastAndCreateWithdrawal(externals, hash, transaction);
            if (transactionHash) {
                externals.forEach((external) => {
                    successTxsHash.push({   
                        externalId: external.id,
                        transactionHash,
                        outputIndex: external.index || 0,
                    });
                });
            }
        });
        console.log('JSON.stringify(successTxsHash):', JSON.stringify(successTxsHash))
        return { payload: JSON.stringify(successTxsHash) };
    }

    async broadcastAndCreateWithdrawal(externals, rawTransaction, transaction) {
        console.log('*---- NEM_Service.broadcastAndCreateWithdrawal ----*')
        return await this.db.transaction(async (trx) => {
            try {
                // Check duplicate
                try {
                    await Promise.each(externals, async (external) => {
                        await this.checkDuplicatedWithdrawal(external.id, null, trx);
                    });
                } catch (err) {
                    this.debug(err.stack);
                    return err
                }
                // broadcast transaction ...
                let response = null;
                try {
                    response = await this.api.broadcast(rawTransaction);
                } catch (err) {
                    response = null;
                }
                if (!response) {
                    return;
                }
                const withdrawals = await this.interpreter.buildBroadcastedWithdrawals(rawTransaction, response, transaction);
                // await this.checkDuplicatedWithdrawal(externals[0].id, withdrawals[0].transactionHash, trx);
                // Create withdrawals from transaction
                await Promise.each(withdrawals, async (withdrawal) => {
                    await this.withdrawals.add(
                        {
                            externalId: externals[0].id || null,
                            service: this.name,
                            amount: withdrawal.amount,
                            currency: withdrawal.currency,
                            toAddress: withdrawal.toAddress,
                            outputIndex: withdrawal.outputIndex,
                            state: this.withdrawals.state.CONFIRMED,
                            transactionHash: withdrawal.transactionHash,
                        },
                        trx,
                    );
                });
                return withdrawals[0].transactionHash;
            } catch (error) {
                this.debug(`Broadcast fail with error ${error}`);
                this.debug(error.stack);
                throw Error(error)
            }
        });
    }

    // Get balance of admin wallet
    // 
    async getTotalBalance(currency, walletId, isColdWallet = true) {
        let totalBalance = "";
        isColdWallet = (isColdWallet === 'true');
        try {
            const wallet = await this.wallets.find(walletId);
            let address = '';
            if (!isColdWallet) {
                address = wallet.settlementAddress;
            } else {
                address = wallet.coldSettlementAddress;
            }
            totalBalance = await this.api.getBalance(address);
        }
        catch (err) {
            console.log('NEM.getTotalBalance.err:', err);
            totalBalance = "0";
        }
        console.log('NEM.totalBalance:', totalBalance);
        return { currency, totalBalance }
    }
}

module.exports = NemService;
