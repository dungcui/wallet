const Decimal = require('decimal.js');

function decimal() {
  return Decimal.clone({ precision: 100 });
}

function getCommonErrors() {
  return {
    MISSING_ADDRESS_OR_CURRENCY: '`address` or `currency` is missing',
    MISSING_XPUB: '`xpub` is missing or empty',
    MISSING_PATH: '`path` is missing or empty',
    MISSING_CURRENCY: '`currency` is missing',
    MISSING_PAYLOAD: '`payload` is missing',
    MISSING_WALLET_ID: '`walletId` is missing',
    MISSING_SETTLEMENT: '`settlement` is missing',
    MISSING_TRANSACTIONS: '`transactions` is missing',
    MISSING_TX_TYPE: 'transaction `type` is missing',
    MISSING_TX_HASH: '`txHash` is missing',
    SETTLEMENT_NOT_FOUND: 'Could not found settlement',
    BLOCK_NOT_FOUND: 'Could not find latest block in db',
    SETTLEMENT_INSUFFICIENT_GAS: 'Settlement has insufficient VTHO to transfer',
    WALLET_NOT_FOUND: 'Could not found wallet',
    INVALID_PAYLOAD: '`payload` is invalid',
    INVALID_WITHDRAWAL_BUNDLE: 'Withdrawal bundle has more than one signed hex',
    WALLET_EXISTED: 'Wallet is already created with this xpub',
  };
}

module.exports = { decimal, getCommonErrors };
