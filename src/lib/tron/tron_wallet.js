const DbTable = require("../../model/db_table");

class TronWallet extends DbTable {
  constructor({ db }) {
    super(db, 'tron_wallets');
  }

  async load(wallet, trx) {
    return this.createQuery(trx).where(wallet).first();
  }

  async add({ xpub , xpubsColdWallets }, trx) {
    return this.createQuery(trx).returning('id').insert({ xpub , xpubsColdWallets});
  }
}

module.exports = TronWallet;
