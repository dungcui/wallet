const sinon = require('sinon');
const awilix = require('awilix');
const { create: createContainer } = require('../../../src/container');

describe('StellarInterpreter', function () {
  let container = createContainer();

  this.timeout(10000);

  beforeEach(() => {
    container = createContainer();
    container.register('STELLAR_ITEM_PER_PAGE', awilix.asValue());
    container.register('STELLAR_API_URL', awilix.asValue('https://horizon.stellar.org'));
  });

  afterEach(() => {

  });

  describe('#computeMinimumBalance', () => {
    it('should return minimum balance', async () => {
      const stellarApi = container.resolve('stellarApi');
      const stellarInterpreter = container.resolve('stellarInterpreter');

      const account = require('./stellar_account.json');
      const latestBlock = require('./stellar_latest_block.json');

      sinon.stub(stellarApi, 'getLatestBlock').returns(latestBlock);
      const minimumBalance = await stellarInterpreter.computeMinimumBalance(account);
      minimumBalance.should.be.equal('1.5');
    });
  });

  // describe('#getMeta', () => {
  //   it('should return minimum balance', async () => {
  //     const stellarApi = container.resolve('stellarApi');
  //     const stellarInterpreter = container.resolve('stellarInterpreter');

  //     const account = require('./stellar_account.json');
  //     const latestBlock = require('./stellar_latest_block.json');

  //     sinon.stub(stellarApi, 'getLatestBlock').returns(latestBlock);
  //     const minimumBalance = await stellarInterpreter.computeMinimumBalance(account);
  //     minimumBalance.should.be.equal('1.5');
  //   });
  // });

  describe('#derive', () => {
    it('should derive correctly', async () => {
      const stellarInterpreter = container.resolve('stellarInterpreter');

      const wallet = {
        settlementAddress: 'GA7OPN4A3JNHLPHPEWM4PJDOYYDYNZOM7ES6YL3O7NC3PRY3V3UX6ANM',
      };
      const pathBefore = '0/1/1';
      const pathAfter = '0/1/2';

      const { address: addressBefore, memo: memoBefore } = await stellarInterpreter.derive(wallet, pathBefore);
      const { address: addressAfter, memo: memoAfter } = await stellarInterpreter.derive(wallet, pathAfter);

      memoBefore.should.not.equal(memoAfter);
      addressBefore.should.be.equal(wallet.settlementAddress);
      addressAfter.should.be.equal(wallet.settlementAddress);
    });
  });

  // describe('#sortTransaction', () => {

  // });

  // describe('#buildBroadcastedWithdrawals', () => {

  // });

  // describe('#deserialize', () => {

  // });

  // describe('#parseAddress', () => {

  // });

  // describe('#parseTransaction', () => {

  // });

  // describe('#getAllTransactionOperations', () => {

  // });

  // describe('#parseRawTransaction', () => {

  // });
});
