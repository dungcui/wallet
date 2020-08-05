const Promise = require('bluebird');
const chai = require('chai');
const awilix = require('awilix');
const knex = require('knex');
const chaiAsPromised = require('chai-as-promised');
const spies = require('chai-spies');
const Decimal = require('decimal.js');

const { create: createContainer } = require('../../../src/container');

// TEST DATA
const block2019 = require('./tron_block_2019.json');

chai.use(chaiAsPromised);
chai.use(spies);
chai.should();

describe('TronMonitor', function () {
  let container;
  let db;

  beforeEach(async function () {
    container = createContainer();

    // Set default config, only stub value
    container.register('tronApiUrl', awilix.asValue('https://api.tronscan.org'));
    container.register('tronNodeUrl', awilix.asValue('https://tron-node.quoine.com'));
    container.register('tronSleepTime', awilix.asValue(0.1));
    container.register('tronStartBlockHeight', awilix.asValue(0));
    container.register('tronMinimumConfirmations', awilix.asValue(0));

    // Set db as SQLite in memory
    db = knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
      },
      migration: {
        directory: './migrations',
      },
      useNullAsDefault: true,
    });
    container.register('db', awilix.asValue(db));

    // Run migrations
    await db.migrate.latest();

    // Test data

    // Setup wallet
    // Seed is 123
    await db('tron_wallets').insert({
      xpub: 'xpub661MyMwAqRbcFAHX6T2C66buGtyJGUHzDFmV1f3GScTEhZkP6uc7GbFE9rzaDEqKUKTpzELCbYw9B8PQcvSz5an1iBuQVBoaCQiZYPK7b2p',
    });

    // Setup address
    await db('tron_addresses').insert({
      walletId: 1,
      path: '0/1',
      hash: 'TAk7MwGT7NqT48CA3szVuVVYhkefoto1hf',
      type: 'user',
    });

    // Setup address
    await db('tron_addresses').insert({
      walletId: 1,
      path: '0/1/1',
      hash: 'TUfs2Msh7iQXDCAi81MbdPPGEk6k47SEUi',
      type: 'user',
    });
  });

  afterEach(async function () {
    chai.spy.restore();
    await db.migrate.rollback();
    await db.destroy();
  });

  describe('#start', function () {
    it('should trigger run', function (done) {
      const tronMonitor = container.resolve('tronMonitor');
      tronMonitor.run = () => done();
      tronMonitor.start();
      tronMonitor.stop();
    });
  });

  describe('#stop', function () {
    it('should stop the monitor', async function () {
      const tronMonitor = container.resolve('tronMonitor');
      await tronMonitor.stop();
      tronMonitor.isRunning.should.equal(false);
    });
  });

  describe('#run', function () {
    context('when isRunning is false', function () {
      it('should not run', async function () {
        const tronMonitor = container.resolve('tronMonitor');
        const tronRpc = container.resolve('tronRpc');
        const getLatestBlock = chai.spy.on(tronRpc, 'getLatestBlock');
        await tronMonitor.run();
        getLatestBlock.should.not.have.been.called();
      });
    });

    context('when no block processed', function () {
      it('should start from environment variable', function (done) {
        this.timeout(10000);
        const tronRpc = {
          ONE_TRX: new Decimal(1e6),
          getBlock: height => ({ height }),
          getLatestBlock: () => ({ height: 1 }),
        };
        const tronParser = { parseBlock: block => block };
        container.register('tronStartBlockHeight', awilix.asValue(0));
        container.register('tronParser', awilix.asValue(tronParser));
        container.register('tronRpc', awilix.asValue(tronRpc));

        const tronMonitor = container.resolve('tronMonitor');
        chai.spy.on(tronMonitor, 'processBlock', ({ height }) => {
          height.should.equal(0);
          tronMonitor.stop();
          done();
        });
        tronMonitor.isRunning = true;
        tronMonitor.run();
      });
    });

    context('when already reached latest height', function () {
      it('should wait', function (done) {
        const tronRpc = {
          ONE_TRX: new Decimal(1e6),
          getBlock: height => ({ height }),
          getLatestBlock: () => ({ number: 1 }),
        };
        const tronBlock = {
          getLatest: () => ({ height: 1 }),
        };
        const tronParser = { parseBlock: block => block };
        container.register('tronRpc', awilix.asValue(tronRpc));
        container.register('tronBlock', awilix.asValue(tronBlock));
        container.register('tronParser', awilix.asValue(tronParser));

        const tronMonitor = container.resolve('tronMonitor');
        const processBlock = chai.spy.on(tronMonitor, 'processBlock');
        setTimeout(() => {
          tronMonitor.stop();
          processBlock.should.not.have.been.called();
          done();
        }, 10);
        tronMonitor.isRunning = true;
        tronMonitor.run();
      });
    });
  });

  describe('#processBlock', function () {
    beforeEach(async function () {
      await db('tron_transactions').insert({
        hash: 'a2d6b49e61df1dbb0cb54e32b0374b36248a309514894ce40e9bd81ca8400e74',
        state: 'pending',
        walletId: 1,
      });
    });

    context('when a block is ok', function () {
      it('should process block', function testProcessBlock(done) {
        this.timeout(10000);

        // Mock tronRpc & tronAddress
        const tronRpc = {
          getBlock: async (height) => { height.should.equal(2019); return block2019; },
        };

        const tronAddress = {
          load: ({ hash }) => (hash === 'TRA7vZqzFxycHjYrrjbjh5iTaywSmDefSV'
            ? { hash, path: 'test-path', type: 'settlement', walletId: 1 }
            : { hash, path: 'test-path', type: 'user', walletId: 1 }),
          type: { USER: 'user' },
        };

        container.register('tronRpc', awilix.asValue(tronRpc));
        container.register('tronAddress', awilix.asValue(tronAddress));
        const tronParser = container.resolve('tronParser');

        // Check event
        const tronMonitor = container.resolve('tronMonitor');
        tronMonitor.on('block', (block) => {
          try {
            block.hash.should.equal(block2019.blockID);
            block.height.should.equal(2019);
            block.confirmedNetworkTxs.TRX[0].should.equal('a2d6b49e61df1dbb0cb54e32b0374b36248a309514894ce40e9bd81ca8400e74');
            block.balancesHash.TRX.TGNdjJGUr4s84AJHN5PFQLTBH3jf7iEEpL.aa9f0625cead2c3bc4c93a27053a3d2dfbfdb9bbfc571e3a0256a4c2708c4407.should.equal('17936501.249477');
            done();
          } catch (err) {
            done(err);
          }
        });

        const block = tronParser.parseBlock(block2019);
        // Process block
        tronMonitor.processBlock(block);
      });
    });

    context('when already processed a height', function () {
      it('should do nothing', async function () {
        const tronBlock = { findByHeight: height => ({ height }) };
        container.register('tronBlock', awilix.asValue(tronBlock));
        const tronMonitor = container.resolve('tronMonitor');
        await tronMonitor.processBlock({ height: 123 });
      });
    });

    context('when there is neither funding nor confirmed tx in a block', function () {
      it('should insert it to database but not emit event', async function () {
        const tronMonitor = container.resolve('tronMonitor');
        const tronParser = container.resolve('tronParser');
        const block = {
          blockID: '00000000000007e3bb678c943e451870e17fcb5a06bc87a5fdaa26270f828ced',
          block_header: {
            raw_data: {},
          },
        };
        await tronMonitor.processBlock(tronParser.parseBlock(block));
      });
    });
  });

  describe('#processRange', function () {
    context('when fromHeight > toHeight', function () {
      it('should not process', function () {
        const tronMonitor = container.resolve('tronMonitor');
        tronMonitor.isRunning = true;
        tronMonitor.processRange(1, 0);
      });
    });

    context('when heightPassing is false', function () {
      it('should wait', async function () {
        this.timeout = 10000;
        const tronMonitor = container.resolve('tronMonitor');
        tronMonitor.isRunning = true;
        tronMonitor.validateBlock = () => false;
        tronMonitor.blocksQueue.push({ height: 1 });
        tronMonitor.blocksQueue.push({ height: 2 });
        setTimeout(() => {
          tronMonitor.stop();
        }, 100);
        await tronMonitor.processRange(1, 1);
        tronMonitor.blocksQueue.length.should.equal(2);
      });
    });
  });

  describe('#fetchBlocks', function () {
    context('when heightPassing is true', function () {
      it('should not delay', function (done) {
        const tronMonitor = container.resolve('tronMonitor');
        tronMonitor.heightPassing = true;
        tronMonitor.isRunning = true;
        tronMonitor.fetchBlock = () => {};
        chai.spy.on(Promise, 'delay', (duration) => {
          duration.should.equal(0);
          done();
        });
        tronMonitor.fetchBlocks(0, 0);
      });
    });

    context('when heightPassing is false', function () {
      it('should delay more', function (done) {
        const tronMonitor = container.resolve('tronMonitor');
        tronMonitor.heightPassing = false;
        tronMonitor.isRunning = true;
        tronMonitor.fetchBlock = () => {};
        chai.spy.on(Promise, 'delay', (duration) => {
          duration.should.equal(1000);
          done();
        });
        tronMonitor.fetchBlocks(0, 0);
      });
    });
  });
});
