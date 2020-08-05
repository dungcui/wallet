const sinon = require('sinon');
const awilix = require('awilix');
const { create: createContainer } = require('../../../src/container');

describe('StellarApi', function () {
  let container = createContainer();

  this.timeout(10000);

  beforeEach(() => {
    container = createContainer();
    container.register('STELLAR_API_URL', awilix.asValue('https://horizon.stellar.org'));
  });

  describe('#getAccount', () => {
    it('should get account', async () => {
      const stellarApi = container.resolve('stellarApi');
      const address = 'GA7OPN4A3JNHLPHPEWM4PJDOYYDYNZOM7ES6YL3O7NC3PRY3V3UX6ANM';
      await stellarApi.getAccount(address);
    });
  });

  describe('#getBlock', () => {
    it('should get block', async () => {
      const stellarApi = container.resolve('stellarApi');
      const height = 17335274;
      await stellarApi.getBlock(height);
    });
  });

  describe('#getLatestBlockHeight', () => {
    it('should get latest block height', async () => {
      const stellarApi = container.resolve('stellarApi');
      await stellarApi.getLatestBlockHeight();
    });
  });

  describe('#getLatestBlock', () => {
    it('should get latest block', async () => {
      const stellarApi = container.resolve('stellarApi');
      await stellarApi.getLatestBlock();
    });
  });

  describe('#findTransactionsByAddress', () => {
    it('should find transactions by address', async () => {
      const stellarApi = container.resolve('stellarApi');
      const address = 'GA7OPN4A3JNHLPHPEWM4PJDOYYDYNZOM7ES6YL3O7NC3PRY3V3UX6ANM';
      await stellarApi.findTransactionsByAddress(address);
    });
  });

  describe('#findOperationsByTransaction', () => {
    it('should find operations by transaction', async () => {
      const stellarApi = container.resolve('stellarApi');
      const hash = 'a49bff6fc642117665b2c2ba210b53167b81435a49005445b17161ea192c3a75';
      await stellarApi.findOperationsByTransaction(hash);
    });
  });

  describe('#broadcast', () => {
    context('when receive a raw xdr', () => {
      it('should broadcast the transaction', async () => {
        const stellarApi = container.resolve('stellarApi');
        sinon.stub(stellarApi, 'broadcast').returns(true);
        const raw = 'AAAAAEJPryK4qJaorsnbdaa/C5PuLpP+MsF5FrGKr9t8+FPbAAAAZAEsfzgAAAACAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAABAAAACGd1aSB0aWVuAAAAAQAAAAAAAAABAAAAAJULzgzR7KyyVMXQ0uC/gwc1m18n9gzO8Q8PHnm3/peiAAAAAAAAAAAAmJaAAAAAAAAAAAF8+FPbAAAAQKH+v2hRe9P9arrYE3Sc7epWvhIo35bFy/rL/8pe8BRyQtJgcsRqSg0BQ+Pc1hTXNkfiESmekkQADd8cHk3Ixg4=';
        await stellarApi.broadcast(raw);
      });
    });
  });
});
