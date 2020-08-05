const chai = require('chai');
const awilix = require('awilix');
const chaiAsPromised = require('chai-as-promised');
const spies = require('chai-spies');
const nock = require('nock');
const { create: createContainer } = require('../../../src/container');

const page0 = require('./tron_transaction_page_0.json');
const page1 = require('./tron_transaction_page_1.json');
const page2 = require('./tron_transaction_page_2.json');
const page3 = require('./tron_transaction_page_3.json');
const page4 = require('./tron_transaction_page_4.json');

const txPages = [page0, page1, page2, page3, page4];
chai.use(chaiAsPromised);
chai.use(spies);
chai.should();

describe('TronApi', function () {
  let container;

  beforeEach(function () {
    container = createContainer();
    container.register('tronApiUrl', awilix.asValue('https://api.tronscan.org'));
    container.register('tronSleepTime', awilix.asValue(0.01));
    chai.spy.restore();
  });

  describe('#getAccount', function () {
    it('should get account', function (done) {
      const tronApi = container.resolve('tronApi');
      const address = 'TUfs2Msh7iQXDCAi81MbdPPGEk6k47SEUi';
      const getBlockPath = `/api/account/${address}`;
      chai.spy.on(tronApi, 'get', (path) => {
        try {
          path.should.equal(getBlockPath);
          done();
        } catch (err) {
          done(err);
        }
      });
      tronApi.getAccount(address);
    });
  });

  describe('#getBlock', function () {
    it('should get block', function (done) {
      const tronApi = container.resolve('tronApi');
      const height = 123;
      const getBlockPath = `/api/block/${height}`;
      chai.spy.on(tronApi, 'get', (path) => {
        try {
          path.should.equal(getBlockPath);
          done();
        } catch (err) {
          done(err);
        }
      });
      tronApi.getBlock(height);
    });
  });

  describe('#getLatestBlock', function () {
    it('should get latest block', function (done) {
      const tronApi = container.resolve('tronApi');
      const getLatestBlockPath = '/api/block/latest';
      chai.spy.on(tronApi, 'get', (path) => {
        try {
          path.should.equal(getLatestBlockPath);
          done();
        } catch (err) {
          done(err);
        }
      });
      tronApi.getLatestBlock();
    });
  });

  describe('#getBlockTransactions', function () {
    it('should get block transactions', async function () {
      const tronApi = container.resolve('tronApi');
      const height = 123;
      const getBlockTransactionsPath = {
        0: `/api/transaction?block=${height}&sort=-timestamp&count=true&start=0&limit=100`,
        1: `/api/transaction?block=${height}&sort=-timestamp&count=true&start=100&limit=100`,
      };
      chai.spy.on(tronApi, 'get', path => ({
        [getBlockTransactionsPath[0]]: { total: 101, data: ['foo'] },
        [getBlockTransactionsPath[1]]: { total: 101, data: ['bar'] },
      }[path]));
      const result = await tronApi.getBlockTransactions(height);
      result.data.should.deep.equal(['foo', 'bar']);
    });
  });

  describe('#broadcast', function () {
    it('should broadcast', function (done) {
      const tronApi = container.resolve('tronApi');
      const transactionString = 'transactionString';
      const broadcastPath = '/api/transaction';
      chai.spy.on(tronApi, 'post', (path, body) => {
        try {
          path.should.equal(broadcastPath);
          const { transaction } = JSON.parse(body);
          transaction.should.equal(transactionString);
          done();
        } catch (err) {
          done(err);
        }
      });
      tronApi.broadcast(transactionString);
    });
  });

  describe('#get', function () {
    context('when normal get', function () {
      beforeEach(function () {
        nock('https://api.tronscan.org').persist().get('/api/block/latest').reply(200, { foo: 'bar' });
      });
      afterEach(function () { nock.cleanAll(); });
      it('should pass', async function () {
        const tronApi = container.resolve('tronApi');
        const result = await tronApi.get('/api/block/latest');
        result.foo.should.equal('bar');
      });
    });

    context('when failed', function () {
      beforeEach(function () {
        nock('https://api.tronscan.org').persist().get('/api/block/latest').reply(500, { foo: 'bar' });
      });
      afterEach(function () { nock.cleanAll(); });
      it('should retry then exit', async function () {
        const tronApi = container.resolve('tronApi');
        try {
          await tronApi.get('/api/block/latest');
        } catch (err) {
          err.toString().should.equal('Error: Failed after 2 retries on path /api/block/latest, exit.');
        }
      });
    });
  });

  describe('#post', function () {
    context('when post', function () {
      beforeEach(function () {
        nock('https://api.tronscan.org').post('/api/transaction').reply(200, { foo: 'bar' });
      });
      afterEach(function () { nock.cleanAll(); });
      it('should pass', async function () {
        const tronApi = container.resolve('tronApi');
        const result = await tronApi.post('/api/transaction');
        result.foo.should.equal('bar');
      });
    });

    context('when failed', function () {
      beforeEach(function () {
        nock('https://api.tronscan.org').persist().post('/api/transaction').reply(500, { foo: 'bar' });
      });
      it('should throw', async function () {
        const tronApi = container.resolve('tronApi');
        try {
          await tronApi.post('/api/transaction');
        } catch (err) {
          err.should.not.be.null;
        }
      });
    });
  });

  describe('#validateAddress', function () {
    context('when address is valid', function () {
      const addressHash = 'TKdXyv2XWBazF9eeWVoQcty1NrMiS1J3Mi';
      beforeEach(function () {
        nock('https://api.tronscan.org')
          .get(`/api/account/${addressHash}`)
          .reply(200, {});
      });
      it('should return true', async function () {
        const tronApi = container.resolve('tronApi');
        const result = await tronApi.validateAddress(addressHash);
        result.should.equal(true);
      });
    });

    context('when address is invalid', function () {
      const addressHash = 'abc';
      beforeEach(function () {
        nock('https://api.tronscan.org')
          .get(`/api/account/${addressHash}`)
          .reply(500, {});
      });
      it('should return true', async function () {
        const tronApi = container.resolve('tronApi');
        const result = await tronApi.validateAddress(addressHash);
        result.should.equal(false);
      });
    });
  });

  describe('#getTransactionsOfPage', function () {
    beforeEach(function () {
      nock('https://api.tronscan.org')
        .persist()
        .get('/api/transaction')
        .query({ start: 0, limit: 10, sort: 'block' })
        .reply(200, { data: 'foobar' });
    });
    afterEach(function () { nock.cleanAll(); });
    it('should return transactions of page', async function () {
      const tronApi = container.resolve('tronApi');
      (await tronApi.getTransactionsOfPage(0, 10)).should.equal('foobar');
    });
  });

  describe('#getTotalTransactions', function () {
    beforeEach(function () {
      nock('https://api.tronscan.org')
        .persist()
        .get('/api/transaction')
        .query({ start: 0, limit: 1, sort: 'block', count: true })
        .reply(200, { total: 300 });
    });
    afterEach(function () { nock.cleanAll(); });
    it('should return total of transactions', async function () {
      const tronApi = container.resolve('tronApi');
      const result = await tronApi.getTotalTransactions(0);
      result.should.equal(300);
    });
  });

  describe('#getBlockHeightsAfter', function () {
    it('should find correct height', async function () {
      const tronApi = container.resolve('tronApi');
      tronApi.getTotalTransactions = async () => 400;
      tronApi.getTransactionsOfPage = async page => txPages[page].data;
      (await tronApi.getBlockHeightsAfter(2047))[0].should.equal(2048);
      (await tronApi.getBlockHeightsAfter(2058)).length.should.equal(0);
    });
  });
});
