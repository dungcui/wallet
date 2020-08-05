const DbTable = require('./db_table');

class FailedApi extends DbTable {
  constructor({ db }) {
    super(db, 'failed_apis');
  }

  async get(service , trx) {
    return this.createQuery(trx).where({ service });
  }

  async findById(service , id , trx) {
    if(!id)
    return this.createQuery(trx).where({ service, id :0 });
    else 
    return this.createQuery(trx).where({ service, id  });
  }

  async delete(service , id , trx) {
    return this.createQuery(trx).where({ service, id }).del();
  }
  async update(service, id , body, err , trx) {
    const found = await this.findById(service , id , trx);
    console.log("found",found)
    if (found.length) {
      await this.createQuery(trx)
        .update({  body, err, updatedAt: this.db.fn.now() })
        .where({ service, id });
    } else {
      await this.createQuery(trx)
        .insert({ service , body, err, createdAt: this.db.fn.now(), updatedAt: this.db.fn.now() });
    }
  }
}

module.exports = FailedApi;
