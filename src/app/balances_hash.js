const DbTable = require("../model/db_table");

class BalancesHash extends DbTable {
  constructor({ db }) {
    super(db, "balances_hash");
  }

  async add(serviceName, content, trx) {
    return this.createQuery(trx).insert({ serviceName, content });
  }
}

module.exports = BalancesHash;
