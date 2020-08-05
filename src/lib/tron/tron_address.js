const hdkey = require('hdkey');
const utils = require('./tron_utils');
const Decimal = require('decimal.js');
const DbTable = require("../../model/db_table");

class TronAddress extends DbTable {
  constructor({ db, tronApi }) {
    super(db, 'tron_addresses');
    this.type = {
      USER: 'user',
      SETTLEMENT: 'settlement',
      COLD : 'cold',
    };
    this.SETTLEMENT_PATH = '0/1/0';
    this.COLD_PATH = '100/0/0';
    this.error = {
      ADDRESS_INVALID: 'Address is not valid',
    };
    this.api = tronApi;
  }

  static derive({ xpub, path }) {
    const wallet = hdkey.fromExtendedKey(xpub);
    const { publicKey } = wallet.derive(`m/${path}`);
    const address = utils.getAddressFromPublicKey(publicKey);
    return address;
  }
  

  static deriveColdWallets({ xpubsColdWallets, path }) {
    const wallet = hdkey.fromExtendedKey(xpubsColdWallets);
    const { publicKey } = wallet.derive(`m/${path}`);
    const address = utils.getAddressFromPublicKey(publicKey);
    return address;
  }

  async validate(address) {
    return this.api.validateAddress(address.hash);
  }

  async generate({ wallet, req }, trx) {
    const { path, type } = req;
    const { xpub } = wallet;
    const hash = this.constructor.derive({ xpub, path });
    const walletId = wallet.id;
    const address = { walletId, path, hash, type };
    await this.create(address, trx);
    return { hash };
  }

  async generateCold({ wallet, req }, trx) {
    const { path, type } = req;
    const { xpubsColdWallets } = wallet;
    const hash = this.constructor.deriveColdWallets({ xpubsColdWallets, path });
    const walletId = wallet.id;
    const address = { walletId, path, hash, type };
    await this.create(address, trx);
    return { hash };
  }

  async create(address, trx) {
    return this.createQuery(trx).insert(address);
  }

  async load(address, trx) {
    return this.createQuery(trx).where(address).first();
  }

  async getNetworkBalance(address) {
    const { balance } = await this.api.getAccount(address.hash);
    return new Decimal(balance);
  }
}

module.exports = TronAddress;
