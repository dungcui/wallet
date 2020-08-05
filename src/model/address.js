const DbTable = require("./db_table");

class Address extends DbTable {
  constructor({ db, wallet }) {
    super(db, "addresses");
    this.type = {
      FEE: "fee",
      USER: "user",
      SETTLEMENT: "settlement",
      COLDWALLET: "cold"
    };
    this.path = {
      FEE: "0/1/0",
      SETTLEMENT: "0/1/0",
      COLDWALLET: "100/0/0"
    };
    this.wallets = wallet;
  }

  async find(id, trx) {
    return this.createQuery(trx)
      .where({ id })
      .first();
  }

  async findByPath(walletId, path, trx) {
    return this.createQuery(trx)
      .where({ walletId, path })
      .first();
  }

  async findByAddress(walletId, address, trx) {
    return this.createQuery(trx)
      .where({ walletId, address })
      .first();
  }

  async findByAddressHash(address, trx) {
    return this.createQuery(trx)
      .where({ address })
      .first();
  }

  async findByAddressHashWithLowerCase(service, address, trx) {
    return this.createQuery(trx)
      .where({ service })
      .whereRaw(`LOWER(address) LIKE ?`, [`%${address}%`])
      .first();
  }

  async findByAddressAndMemo(address, memo, trx) {
    return this.createQuery(trx)
      .where({ address, memo })
      .first();
  }

  async findAllByHashes(service, hashes, trx) {
    return this.createQuery(trx)
      .where({ service })
      .whereIn("address", hashes);
  }

  async findAllByService(service, trx) {
    return this.createQuery(trx).where({ service });
  }

  async findSettlement(service, address, trx) {
    return this.createQuery(trx)
      .where({ service, address, type: this.type.SETTLEMENT })
      .first();
  }

  async findSettlementFromService(service, trx) {
    return this.createQuery(trx)
      .where({ service, type: this.type.SETTLEMENT })
      .first();
  }

  async findByAddressAndService(service, address, trx) {
    return this.createQuery(trx)
      .where(`${this.tableName}.service`, service)
      .where({ address })
      .first();
  }

  async findByAddressAndMemoAndService(service, address, memo, trx) {
    return this.createQuery(trx)
      .where(`${this.tableName}.service`, service)
      .where({ address, memo })
      .first();
  }

  async create({ service, walletId, path, address, memo, type }, trx) {
    return this.createQuery(trx).insert({
      service,
      walletId,
      path,
      address,
      memo,
      type
    });
  }
}

module.exports = Address;
