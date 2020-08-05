const Service = require('../service.js');

// This unify service is for testing only
class UnifyService extends Service {
  constructor({
    db,
    block,
    token,
    wallet,
    address,
    funding,
    withdrawal,
    unifyApi: api,
    unifyInterpreter: interpreter,
  }) {
    const baseFee = '0.5';
    const name = 'UNIFY';
    const currency = 'UNIFY';
    const feeCurrency = 'UNIFY';

    super({
      // Global
      db,
      api,
      block,
      token,
      wallet,
      address,
      funding,
      withdrawal,

      // Config
      name,
      baseFee,
      currency,
      feeCurrency,
      interpreter,
    });

    this.NATIVE_ISSUER = 'native';
  }

  async validateWallet() {
    return true;
  }
}

module.exports = UnifyService;
