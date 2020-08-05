const DbTable = require('./db_table');

class Limit extends DbTable {
  constructor({ db }) {
    super(db, 'limits');
  }

  async get(service, walletId, trx) {
    return this.createQuery(trx).where({ service , walletId }).first();
  }
  async update(service, walletId, limits, trx) {
    console.log('*---- Currencies.update ----*')
    const found = await this.get(service,walletId, trx);
    if (found) {
      await this.createQuery(trx)
        .update({ limits, updatedAt: this.db.fn.now() })
        .where({service ,walletId});
    } else {
      await this.createQuery(trx)
        .insert({ service ,walletId ,limits });
    }
  }

  async getByService(service, trx) {
    return this.createQuery(trx).where({ service }).first();
  }

  async getAll(trx) {
    return this.createQuery(trx);
  }
  
}

module.exports = Limit;
