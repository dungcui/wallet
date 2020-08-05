class DbTable {
  constructor(db, tableName) {
    this.db = db;
    this.tableName = tableName;
  }

  createQuery(trx) {
    const query = this.db(this.tableName);
    if (trx) {
      return query.transacting(trx);
    }
    return query;
  }
}

module.exports = DbTable;
