const Decimal = require('decimal.js');
const Service = require('../service.js');
const constants = require('./sophiatx_constants');

class SophiatxService extends Service {
  constructor({
    db,
    block,
    token,
    wallet,
    address,
    funding,
    withdrawal,
    sophiatxApi: api,
    sophiatxInterpreter: interpreter,
  }) {
    const { NAME: name, CURRENCY: currency, FEE_CURRENCY: feeCurrency } = constants;
    const baseFee = new Decimal(constants.BASE_FEE);
    const error = {
      ALREADY_HAS_WALLET: 'Already has wallet.',
      MISSING_SETTLEMENT_ADDRESS: 'Missing settlement address.',
      INVALID_SETTLEMENT_ADDRESS: 'Invalid settlement address.',
    };
    super({
      db,
      api,
      block,
      token,
      wallet,
      address,
      funding,
      withdrawal,

      name,
      error,
      baseFee,
      currency,
      feeCurrency,
      interpreter,
    });
    this.NATIVE_ISSUER = constants.ASSET_TYPE_NATIVE;
  }

  async validateAddress(req) {
    const { hash } = req;
    if (!hash) throw Error(this.error.MISSING_ADDRESS);
    try {
      const valid = await this.api.accountExist(hash);
      return { valid };
    } catch (err) {
      return { valid: false };
    }
  }

  async validateWallet(req) {
    const { settlementAddress } = req;
    if (!settlementAddress) throw Error(this.error.MISSING_SETTLEMENT_ADDRESS);

    // Validate settlementAddress
    const { valid } = await this.validateAddress({ hash: settlementAddress });
    if (!valid) throw Error(this.error.INVALID_SETTLEMENT_ADDRESS);

    // Check if settlementAddress already used
    const found = await this.wallets.findBySettlementAddress(this.name, settlementAddress);
    if (found) throw Error(this.error.ALREADY_HAS_WALLET);
  }
}

module.exports = SophiatxService;
