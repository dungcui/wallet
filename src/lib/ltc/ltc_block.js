const DbTable = require("../../model/db_table");

class LtcBlock extends DbTable {
  constructor({ db }) {
    super(db, 'ltc_blocks');
  }

  async getLatest(trx) {
    return this.createQuery(trx).orderBy('height', 'desc').first();
  }

  async add(hash, height, fee, trx) {
    return this.createQuery(trx).insert({ hash, height, fee });
  }

  async getAverageFee(numberOfBlocks, trx) {
    const result = await this.createQuery(trx)
      .avg('fee as fee')
      .from(this.createQuery().orderBy('height', 'desc').limit(numberOfBlocks).as('f'))
      .first();
    return result ? result.fee : null;
  }
}

module.exports = LtcBlock;
