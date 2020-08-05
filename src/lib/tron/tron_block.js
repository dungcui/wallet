const DbTable = require("../../model/db_table");

class TronBlock extends DbTable {
  constructor({ db }) {
    super(db, 'tron_blocks');
  }

  async getLatest(trx) {
    return this.createQuery(trx).orderBy('height', 'desc').first();
  }

  async findByHeight(height, trx) {
    return this.createQuery(trx).where({ height }).first();
  }

  async add({ height }, trx) {
    const found = await this.getLatest(trx);
    if (found) {
      await this.createQuery(trx)
        .update({ height, updatedAt: this.db.fn.now() })
    } else {
      await this.createQuery(trx)
        .insert({  height });
    }
  }
}

module.exports = TronBlock;
