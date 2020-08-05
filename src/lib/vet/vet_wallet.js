const DbTable = require("../../model/db_table");

class VetWallet extends DbTable {
  constructor({ db }) {
    super(db, 'vet_wallets');
  }

  async add({ xpubs, xpubsColdWallets }) {
    const result = await this.createQuery().returning('id').insert({
      xpub: xpubs[0], xpubsColdWallets : xpubsColdWallets[0],
    });

    return result[0];
  }

  async find(walletId, trx) {
    if (!walletId) return undefined;

    const found = await this.createQuery(trx).where({ id: walletId }).first();

    return found;
  }

  async findByXPub(xpub, trx) {
    return this.createQuery(trx).where({ xpub }).first();
  }
}

module.exports = VetWallet;
