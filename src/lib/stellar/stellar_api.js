const { Server, Network, xdr, Transaction } = require("stellar-sdk");
const constants = require("./stellar_constants");
const StellarBase = require("stellar-base");

Network.PUBLIC;

class StellarApi {
  constructor({ STELLAR_API_URL: url }) {
    this.url = url;
    if (!this.url) {
      throw Error("Please provide STELLAR_API_URL");
    }
    this.server = new Server(url);
  }

  async getAccount(address) {
    return this.server.loadAccount(address);
  }

  async getBlock(height) {
    const result = await this.server
      .ledgers()
      .ledger(height)
      .call();
    return result;
  }

  async getLatestBlockHeight() {
    return (await this.getLatestBlock()).sequence;
  }

  async getLatestBlock() {
    const result = await this.server
      .ledgers()
      .limit(1)
      .order("desc")
      .call();
    return result.records[0];
  }

  async findTransactionsByAddress(address, limit = 10, order = "asc") {
    return this.server
      .transactions()
      .forAccount(address)
      .order(order)
      .limit(limit)
      .call();
  }

  async findOperationsByTransaction(hash, limit = 10, order = "asc") {
    return this.server
      .operations()
      .forTransaction(hash)
      .order(order)
      .limit(limit)
      .call();
  }

  async broadcast(raw) {
    console.log("raw:", raw);
    // Parse from raw to transaction
    const buffer = Buffer.from(raw, "base64");
    const envelope = xdr.TransactionEnvelope.fromXDR(buffer);
    const transaction = new Transaction(envelope, {
      fee: StellarBase.BASE_FEE,
      networkPassphrase: StellarBase.Networks.PUBLIC
    });
    console.log("transaction:", transaction);

    // Upload
    const tx = await this.server.submitTransaction(transaction);
    console.log("API.Broadcast.tx:", tx.hash);
    return tx.hash;
  }

  async getBalance(wallet) {
    const { balances } = await this.getAccount(wallet);
    var balanceAmount = 0;
    console.log("balances:", balances);
    balances.forEach(balance => {
      if (balance.asset_type == constants.ASSET_TYPE_NATIVE) {
        balanceAmount = balance.balance;
      }
    });
    console.log("balanceAmount:", balanceAmount);
    return balanceAmount;
  }
}

module.exports = StellarApi;
