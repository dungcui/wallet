const chai = require('chai');
const awilix = require('awilix');
const chaiAsPromised = require('chai-as-promised');
const spies = require('chai-spies');
const nock = require('nock');
const { create: createContainer } = require('../../../src/container');

chai.use(chaiAsPromised);
chai.use(spies);
chai.should();

describe('TronRpc', function () {
  let container;

  beforeEach(function () {
    nock.restore();
    nock.activate();
    chai.spy.restore();
    container = createContainer();
    container.register('tronNodeUrl', awilix.asValue('https://user:pass@1.1.1.1'));
    container.register('tronSleepTime', awilix.asValue(0.01));
  });

  describe('#getBlock', function () {
    it('should get block', async function () {
      const num = 135;
      const tronRpc = container.resolve('tronRpc');
      nock(tronRpc.base)
        .post('/wallet/getblockbynum', JSON.stringify({ num }))
        .reply(200, { height: num });
      const block = await tronRpc.getBlock(num);
      block.height.should.equal(num);
    });
  });

  describe('#getBlock', function () {
    it('should get block', async function () {
      const num = 246;
      const tronRpc = container.resolve('tronRpc');
      nock(tronRpc.base)
        .post('/wallet/getnowblock')
        .reply(200, { height: num });
      const block = await tronRpc.getLatestBlock(num);
      block.height.should.equal(num);
    });
  });

  describe('#post', function () {
    context('when reach MAX_ATTEMPT', function () {
      it('should throw', function (done) {
        const tronRpc = container.resolve('tronRpc');
        tronRpc.MAX_ATTEMPT = 10;
        tronRpc
          .post(null, null, 10)
          .catch(() => done());
      });
    });

    context('when reach MAX_ATTEMPT', function () {
      it('should throw', function (done) {
        const tronRpc = container.resolve('tronRpc');
        tronRpc.MAX_ATTEMPT = 10;
        tronRpc
          .post(null, null, 10)
          .catch(() => done());
      });
    });

    context('when request result in error', function () {
      it('should retry and throw', async function () {
        const tronRpc = container.resolve('tronRpc');
        nock(tronRpc.base)
          .persist()
          .post('/foo', 'bar')
          .reply(500);

        try {
          await tronRpc.post('/foo', 'bar');
        } catch (err) {
          err.should.not.be.null;
        }
      });
    });
  });
});
