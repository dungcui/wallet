const DbTable = require('./db_table');

class Wallet extends DbTable {
  constructor({ db }) {
    super(db, 'wallets');

    this.type = {
      COLDWALLET: 'cold',
      HOTWALLET: 'hot',
    };
  }
  

  async create({ service, xpubs, minimum, settlementAddress, xpubsColdWallets , coldSettlementAddress }, trx) {
    const result = await this.createQuery(trx)
      .returning('id')
      .insert({ service, xpubs, minimum, settlementAddress, xpubsColdWallets , coldSettlementAddress });
    return this.find(result[0], trx);
  }

  async update(id, settlementAddress, trx) {
    return this.createQuery(trx)
      .where({ id })
      .update({ settlementAddress });
  }

  async updateColdAddress(id, coldSettlementAddress, trx) {
    return this.createQuery(trx)
      .where({ id })
      .update({ coldSettlementAddress });
  }

  async find(id, trx) {
    return this.createQuery(trx).where({ id }).first();
  }

  async findByXpubs(service, xpubs, trx) {
    return this.createQuery(trx).where({ service, xpubs }).first();
  }

  async findBySettlementAddress(service, settlementAddress, trx) {
    return this.createQuery(trx).where({ service, settlementAddress }).first();
  }


  async findBySettlementAddressAndType(service, settlementAddress, type, trx) {
    return this.createQuery(trx).where({ service, settlementAddress ,type}).first();
  }

  async findAll(trx) {
    return this.createQuery(trx);
  }

  async findAllByService(service, trx) {
    return this.createQuery(trx).where({ service });
  }

  async findByService(service, trx) {
    return this.createQuery(trx).where({ service }).first();
  }




}

module.exports = Wallet;
