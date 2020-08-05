const DbTable = require("../../model/db_table");

class BtcAddress extends DbTable {
  constructor({ db }) {
    super(db, "btc_addresses");
    this.TYPE = {
      FEE: -1,
      ORDINARY: 0,
      CHANGE: 1
    };
  }

  async findByPath(walletId, path, trx) {
    return this.createQuery(trx)
      .where("walletId", walletId)
      .where("path", path)
      .first();
  }

  async findByHash(hash, trx) {
    return this.createQuery(trx)
      .where("hash", hash)
      .first();
  }

  async create(walletId, path, hash, type, trx) {
    return this.createQuery(trx).insert({
      walletId,
      path,
      hash,
      type
    });
  }

  async getChange(walletId, trx) {
    return (
      this.createQuery(trx)
        .where("walletId", walletId)
        // Change addresss
        .where("type", this.TYPE.CHANGE)
        .first()
    );
  }
}

module.exports = BtcAddress;
