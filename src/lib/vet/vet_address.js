const DbTable = require("../../model/db_table");

class VetAddress extends DbTable {
  constructor({ db }) {
    super(db, "vet_addresses");

    this.SETTLEMENT_PATH = "0/1/0";
    this.COLDWALLET = "0/0/100";
    this.TYPE = {
      USER: "user",
      SETTLEMENT: "settlement",
      COLDWALLET: "cold"
    };
    this.normalizeInput = this.constructor.normalizeInput;

    this.VTHO_CONTRACT_ADDRESS = "0x0000000000000000000000000000456e65726779";
  }

  async findByPath({ walletId, path }, trx) {
    return this.createQuery(trx)
      .where({ walletId, path })
      .first();
  }

  async findByAddresses(addresses, trx) {
    const lowerCaseAdd = addresses.map(add => add.toLowerCase());

    return this.createQuery(trx).whereIn("hash", lowerCaseAdd);
  }

  async add(newAddress, trx) {
    const address = Object.assign({}, newAddress); // shallow copy
    if (!address.hash) throw Error("`hash` is missing");

    address.hash = address.hash.toLowerCase();

    return this.createQuery(trx).insert(address);
  }

  async findSettlement(walletId, trx) {
    return this.createQuery(trx)
      .where({ walletId, type: this.TYPE.SETTLEMENT })
      .first();
  }
}

module.exports = VetAddress;
