const DbTable = require("../../model/db_table");

class BtcWallet extends DbTable {
  constructor({ db }) {
    super(db, "btc_wallets");
  }

  async create(xpubs, minimum, trx) {
    const result = await this.createQuery(trx)
      .returning("id")
      .insert({
        xpubs: xpubs.join(","),
        minimum
      });
    return this.find(result[0]);
  }

  async find(id, trx) {
    const found = await this.createQuery(trx)
      .where("id", id)
      .first();
    if (!found) {
      return null;
    }
    found.xpubs = found.xpubs.split(",");
    return found;
  }
}

module.exports = BtcWallet;
