const DbTable = require('./db_table');

class Block extends DbTable {
  constructor({ db }) {
    super(db, 'blocks');
  }

  async get(service, trx) {
    return this.createQuery(trx).where({ service }).first();
  }

  async update(service, height, trx) {
    const found = await this.get(service, trx);
    if (found) {
      await this.createQuery(trx)
        .update({ height, updatedAt: this.db.fn.now() })
        .where({ service });
    } else {
      await this.createQuery(trx)
        .insert({ service, height });
    }
  }
}

module.exports = Block;
