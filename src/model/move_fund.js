const DbTable = require("./db_table");

class MoveFund extends DbTable {
  constructor({ db }) {
    super(db, "move_funds");
    this.state = {
      CONFIRMED: "confirmed",
      PENDING: "pending",
      FAILED: "failed"
    };
  }

  async add(
    {
      service,
      toAddress,
      transactionHash,
      outputIndex,
      currency,
      amount,
      externalId,
      state
    },
    trx
  ) {
    await this.createQuery(trx).insert({
      service,
      toAddress,
      transactionHash,
      outputIndex,
      currency,
      amount,
      externalId,
      state: state || this.state.PENDING
    });
  }

  async find(service, transactionHash, outputIndex, trx) {
    return this.createQuery(trx)
      .where({ service, transactionHash, outputIndex })
      .first();
  }

  async findExternalId(service, externalId, trx) {
    return this.createQuery(trx)
      .where({ service, externalId })
      .first();
  }

  async update(
    service,
    toAddress,
    transactionHash,
    outputIndex,
    currency,
    amount,
    externalId,
    state,
    trx
  ) {
    const found = await this.findAllByExternalId(service, externalId, trx);
    if (found) {
      await this.createQuery(trx)
        .update({
          toAddress,
          transactionHash,
          outputIndex,
          currency,
          amount,
          state,
          updatedAt: this.db.fn.now()
        })
        .where({ service, externalId });
    } else {
      await this.createQuery(trx).insert({
        service,
        toAddress,
        transactionHash,
        outputIndex,
        currency,
        amount,
        externalId,
        state: state || this.state.PENDING
      });
    }
  }

  async findAllByTransactionHash(service, transactionHash, trx) {
    return this.createQuery(trx).where({ service, transactionHash });
  }

  async findAllByTransactionHashAndExternalId(
    service,
    transactionHash,
    externalId,
    trx
  ) {
    return this.createQuery(trx).where({
      service,
      transactionHash,
      externalId
    });
  }

  async findAllByExternalId(service, externalId, trx) {
    return this.createQuery(trx).where({ service, externalId });
  }

  async markAsConfirmed(service, transactionHash, trx) {
    await this.createQuery(trx)
      .where({ service, transactionHash })
      .update({
        updatedAt: this.db.fn.now(),
        state: this.state.CONFIRMED
      });
  }
}

module.exports = MoveFund;
