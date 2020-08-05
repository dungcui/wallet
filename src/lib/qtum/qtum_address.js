const DbTable = require("../../model/db_table");

class QtumAddress extends DbTable {
  constructor({ db }) {
    super(db, 'qtum_addresses');
    this.type = {
      FEE: 'fee',
      USER: 'user',
      SETTLEMENT: 'settlement',
    };
    this.path = {
      FEE: '0/1/0',
      SETTLEMENT: '0/1/0',
    };
  
  }

  async findByPath(walletId, path, trx) {
    return this.createQuery(trx)
      .where('walletId', walletId)
      .where('path', path)
      .first();
  }

  async findByHash(hash, trx) {
    return this.createQuery(trx)
      .where('hash', hash)
      .first();
  }

  async create({hash,path, type, walletId},trx) {
    return this.createQuery(trx)
      .insert({
        hash,path,type,walletId
      });
  }

  async getChange(walletId, trx) {
    return this.createQuery(trx)
      .where('walletId', walletId)
      // Change addresss
      .where('type', this.TYPE.CHANGE)
      .first();
  }
}

module.exports = QtumAddress;
