const DbTable = require("../../model/db_table");

class BtcTxOut extends DbTable {
  constructor({ db, btcAddress }) {
    super(db, "btc_tx_outs");
    this.addresses = btcAddress;
    this.STATUS = {
      UNSPENT: 1,
      PENDING: 0,
      SPENT: -1
    };
  }

  async add(blockHeight, txHash, index, amount, addressHash, script, trx) {
    const { id, walletId } = await this.addresses.findByHash(addressHash, trx);
    // Check if exist
    const found = await this.createQuery(trx)
      .where("txHash", txHash)
      .where("index", index)
      .first();
    if (found) {
      // Do nothing
      return found;
    }
    return this.createQuery(trx).insert({
      blockHeight,
      txHash,
      index,
      amount,
      addressId: id,
      walletId,
      script,
      status: this.STATUS.UNSPENT,
      spentTxHash: null,
      spentAt: null
    });
  }

  async find(txHash, index, trx) {
    return this.createQuery(trx)
      .where("txHash", txHash)
      .where("index", index)
      .first();
  }

  async markAsSpent(txHash, index, spentTxHash, trx, spentAtBlockHeight) {
    return this.createQuery(trx)
      .where("txHash", txHash)
      .where("index", index)
      .update({
        spentTxHash,
        status: this.STATUS.SPENT,
        spentAt: this.db.fn.now(),
        spentAtBlockHeight
      });
  }

  async markAsPending(txHash, index, spentTxHash, trx) {
    return this.createQuery(trx)
      .where("txHash", txHash)
      .where("index", index)
      .update({
        spentTxHash,
        status: this.STATUS.PENDING,
        spentAt: this.db.fn.now()
      });
  }

  async getUnspentWithAddress(walletId, limit, trx) {
    return (
      this.createQuery(trx)
        .select(
          `${this.tableName}.*`,
          `${this.addresses.tableName}.hash AS addressHash`,
          `${this.addresses.tableName}.path AS addressPath`
        )
        .innerJoin(
          this.addresses.tableName,
          `${this.tableName}.addressId`,
          `${this.addresses.tableName}.id`
        )
        .where("status", this.STATUS.UNSPENT)
        .where(`${this.tableName}.walletId`, walletId)
        // Normal and change address
        .where(`${this.addresses.tableName}.type`, ">=", 0)
        .orderBy("amount", "desc")
        .limit(limit)
    );
  }

  async getTotalBalance(walletId, trx) {
    const { total } = await this.createQuery(trx)
      .sum("amount as total")
      .where("status", ">=", this.STATUS.PENDING)
      .where("walletId", walletId)
      .first();
    return total || 0;
  }

  async getAvailableBalance(walletId, trx) {
    const { total } = await this.createQuery(trx)
      .sum("amount as total")
      .where("status", this.STATUS.UNSPENT)
      .where("walletId", walletId)
      .first();
    return total || 0;
  }

  async getWithdrawalBalance(walletId, limit, trx) {
    const { total } = await this.createQuery(trx)
      .sum("amount as total")
      .from(
        this.createQuery()
          .where("status", this.STATUS.UNSPENT)
          .where("walletId", walletId)
          .orderBy("amount", "desc")
          .limit(limit)
          .as("f")
      )
      .first();
    return total || 0;
  }
}

module.exports = BtcTxOut;
