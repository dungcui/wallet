const DbTable = require("../../model/db_table");

class BtcBundle extends DbTable {
  constructor({ db }) {
    super(db, "btc_bundles");
    this.STATUS = {
      IGNORED: -2,
      FAILED: -1,
      UPLOADED: 0,
      CONFIRMED: 1
    };
  }

  async find(txHash, trx) {
    return this.createQuery(trx)
      .where({ txHash })
      .first();
  }

  async add(txHash, content, trx) {
    const found = await this.find(txHash, trx);
    if (found) {
      return;
    }
    await this.createQuery(trx).insert({
      txHash,
      content,
      status: this.STATUS.UPLOADED
    });
  }

  async markAsConfirmed(txHash, confirmedBlockHeight, trx) {
    const found = await this.find(txHash, trx);
    if (!found) {
      throw Error("Transaction hash not found");
    }
    await this.createQuery(trx)
      .where({ txHash })
      .update({
        status: this.STATUS.CONFIRMED,
        confirmedBlockHeight,
        confirmedAt: this.db.fn.now()
      });
  }

  async getAwaiting(trx) {
    return this.createQuery(trx).where("status", this.STATUS.UPLOADED);
  }
}

module.exports = BtcBundle;
