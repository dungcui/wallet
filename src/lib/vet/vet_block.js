const DbTable = require("../../model/db_table");

class VetBlock extends DbTable {
  constructor({ db }) {
    super(db, 'vet_blocks');
  }

  async getLatest(trx) {
    return this.createQuery(trx).orderBy('height', 'desc').first();
  }

  async add({  height }, trx) {
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

module.exports = VetBlock;
