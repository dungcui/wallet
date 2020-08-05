const DbTable = require("./db_table");

class Token extends DbTable {
  constructor({ db }) {
    super(db, "tokens");
  }

  async create({ service, currency, address }, trx) {
    await this.createQuery(trx).insert({ service, currency, address });
  }

  async createWithEnable(
    { service, currency, address, enabled, decimals },
    trx
  ) {
    await this.createQuery(trx).insert({
      service,
      currency,
      address,
      enabled,
      decimals
    });
  }

  async findContractByAddressAndService(service, address, trx) {
    return this.createQuery(trx)
      .where(`${this.tableName}.service`, service)
      .whereRaw(`LOWER(address) LIKE ?`, [`%${address}%`])
      .first();
  }

  async findContractByCurrencyAndService(service, currency, trx) {
    return this.createQuery(trx)
      .where(`${this.tableName}.service`, service)
      .where(`${this.tableName}.currency`, currency)
      .first();
  }

  async find(service, currency, trx) {
    return this.createQuery(trx)
      .where({ service, currency })
      .first();
  }

  async findAll(trx) {
    return this.createQuery(trx);
  }

  async preload(serviceNames, trx) {
    this.tokens = await this.createQuery(trx).whereIn("service", serviceNames);
  }

  get(service, currency) {
    return this.tokens.find(
      t => t.service === service && t.currency === currency
    );
  }

  getAllByService(service) {
    return this.tokens.filter(t => t.service === service);
  }

  isEnabled(service, currency, address) {
    // Check for column enabled of table Token
    const found = this.tokens.find(
      token =>
        token.service === service &&
        token.currency === currency &&
        token.enabled
    );
    return found && (!found.address || found.address === address);
  }
}

module.exports = Token;
