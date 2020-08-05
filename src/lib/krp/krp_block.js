const DbTable = require("../../model/db_table");

class KrpBlock extends DbTable {
  constructor({ db }) {
    super(db, 'krp_blocks');
  }

  async getLatest(trx) {
    return this.createQuery(trx).orderBy('height', 'desc').first();
  }

  async add( height, trx) {
    return this.createQuery(trx).insert({  height });
  }

  async getAverageFee(numberOfBlocks, trx) {
    const result = await this.createQuery(trx)
      .avg('fee as fee')
      .from(this.createQuery().orderBy('height', 'desc').limit(numberOfBlocks).as('f'))
      .first();
    return result ? result.fee : null;
  }
}

module.exports = KrpBlock;
