const DbTable = require("../../model/db_table");

class neoContract extends DbTable {
  constructor({ db }) {
    super(db, 'erc20_contracts');
  }

  async get({ currency }, trx) {
    return this
      .db(this.tableName)
      .transacting(trx)
      .where('currency', currency)
      .first();
  }

  async findContractByAddress(address, trx) {
    return this.createQuery(trx)
    .whereRaw(`LOWER(address) LIKE ?`, [`%${address}%`]).first();
  }

  async add({
    address,currency,decimals
  }, trx) {
    await this.createQuery(trx).insert({
      address,
      currency,
      decimals,
    });
  }
}

module.exports = neoContract;
