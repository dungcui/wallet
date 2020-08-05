class OntologyConstants {
  constructor({
    ONTOLOGY_BASE_FEE,
  }) {
    this.SERVICE_NAME = 'ONTOLOGY';
    this.CURRENCY = 'ONT';
    this.FEE_CURRENCY = 'ONG';
    this.FEE_AMOUNT = ONTOLOGY_BASE_FEE;
    this.FEE_CURRENCY_DECIMAL = '1e9';

    // Minimum deposit is more than 0.01 ONG because of fee is 0.01 ONG per 1 transaction
    this.ONG_MIN_DEPOSIT = 0.01;

    this.ONT_CONTRACT_ADDRESS = '0100000000000000000000000000000000000000';
    this.ONG_CONTRACT_ADDRESS = '0200000000000000000000000000000000000000';
  }
}

module.exports = OntologyConstants;
