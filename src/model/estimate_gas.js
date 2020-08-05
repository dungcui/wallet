const DbTable = require("./db_table");

class EstimateGas extends DbTable {
  constructor({ db }) {
    super(db, "estimate_gas");
  }

  async add({ service, gasPrice }, trx) {
    await this.createQuery(trx).insert({
      service,
      gasPrice
    });
  }
  async findByService(service, trx) {
    return this.createQuery(trx)
      .where({ service })
      .first();
  }

  async update(service, gasPrice, trx) {
    const found = await this.findByService(service, trx);
    if (found) {
      await this.createQuery(trx)
        .update({
          service,
          gasPrice,
          updatedAt: this.db.fn.now()
        })
        .where({ service });
    } else {
      await this.createQuery(trx).insert({
        service,
        gasPrice,
        createdAt: this.db.fn.now(),
        updatedAt: this.db.fn.now()
      });
    }
  }
}

module.exports = EstimateGas;
