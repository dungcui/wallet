const chai = require('chai');
const awilix = require('awilix');
const knex = require('knex');
const path = require('path');
const fs = require('fs');
const Promise = require('bluebird');
const bitcoin = require('bitcoinjs-lib');
const chaiAsPromised = require('chai-as-promised');
const { create: createContainer } = require('../../../src/container');

const expect = chai.expect;
chai.use(chaiAsPromised);
chai.should();

Promise.promisifyAll(fs);

describe('BtcMonitor', function () {
  let container, db;

  beforeEach(async function () {
    this.timeout(10000);
    container = createContainer();
    // Set default config, only stub value
    container.register('btcSleepTime', awilix.asValue(10));
    container.register('btcStartBlockHeight', awilix.asValue(0));
    container.register('btcMinimumConfirmation', awilix.asValue(6));
    container.register('btcNodeUrl', awilix.asValue('http://user:pass@1.1.1.1'));
    // Set db as SQLite in memory
    db = knex({
    client: 'sqlite3',
      connection: {
        filename: ':memory:'
      },
      migration: {
        directory: './migrations'
      },
      useNullAsDefault: true
    });
    container.register('db', awilix.asValue(db));
    // Run migrations
    const migrate = db.migrate;
    await migrate.latest();

    // Test data
    // Setup wallet
    await db('btc_wallets').insert({
      minimum: 2,
      xpubs: [
        'xpub661MyMwAqRbcGiX6uqGoCShetS6FCrAzrrTUYV2whCHnKeWXaXwBdWz148mombFKkWEdf4boYos2dBWHuzEHC2vYTJgCTjvn2je114vjHo5',
        'xpub661MyMwAqRbcGUsp62ddp93UybjTLyp7QxCTZCcwcmN6XzLsxHKiecADXETFDvYMLFPg5BVwypBXZh3DVB3kxrHXRDbVcVh1mSgGnUKN3on'
      ].join(',')
    });
    await db('btc_wallets').insert({
      minimum: 2,
      xpubs: [
        'xpub661MyMwAqRbcGiX6uqGoCShetS6FCrAzrrTUYV2whCHnKeWXaXwBdWz148mombFKkWEdf4boYos2dBWHuzEHC2vYTJgCTjvn2je114vjHo5',
        'xpub661MyMwAqRbcGUsp62ddp93UybjTLyp7QxCTZCcwcmN6XzLsxHKiecADXETFDvYMLFPg5BVwypBXZh3DVB3kxrHXRDbVcVh1mSgGnUKN3on',
        'xpub661MyMwAqRbcF6R23pieDssxafc3z1R7Ehac7VQtUqBFnCq57j7wFQxSA8nMHE5KsVjz7ir65CLRixzNX4SfWjh8jFbs276it8ypFSxQes9'
      ].join(',')
    });
    // single-sig
    await db('btc_wallets').insert({
      minimum: 1,
      xpubs: [
        'xpub661MyMwAqRbcGKDsqPoLSsjhN7GBkgrphSUnGZpr3wdPXgUWbkKaNRvcJq5ZGGdfXdNq55yLNSgKmmo5ELmcVCRuYopjHL3hLSW39GECrPN',
      ].join(',')
    });
    // Setup address
    await db('btc_addresses').insert({
      walletId: 1,
      path: '0/2',
      hash: '33qqgc5dyBuYeHqdPxFE5sMK8ac4bnLozL',
      type: 0,
    });
    // Change
    await db('btc_addresses').insert({
      walletId: 1,
      path: '0/1/0',
      hash: '3AQUXRuCLxvapAQ9u62uWpLCpJKmd2GLY2',
      type: 1,
    });
    // Other
    await db('btc_addresses').insert({
      walletId: 1,
      path: '0/5',
      hash: '34t3xJGDpn9W1hiNy6dRmMv7r9Nopmmgpd',
      type: -2,
    });
    await db('btc_addresses').insert({
      walletId: 2,
      path: '0/2',
      hash: '33qqgc5dyBuYeHqdPxFE5sMK8ac4bnLdsd',
      type: 0,
    });
    await db('btc_addresses').insert({
      walletId: 2,
      path: '0/3',
      hash: '34Vg65FPmhhnX3D5v1v6rhjmTXzXypgZoY',
      type: 0,
    });
    // Setup tx outs
    await db.batchInsert('btc_tx_outs', [
      // Spent
      { id: 111111, blockHeight: 511234, txHash: '9046ea3d7b1e9a9f986786ac5af38e9f9bc143233aea32306d4a9c0ec727f7fb', index: 0, amount: '5602148', addressId: 1, walletId: 1, script: 'script1', spentTxHash: '02e7c92e569ebf319a52a1f07fd115509a73968fcf4c3b6420f5522c3c65ea83', status: -1, createdAt: '2018-02-28 00:28:09', spentAt: '2018-02-29 00:58:09' },
      // Unspent
      { id: 222222, blockHeight: 511234, txHash: '9046ea3d7b1e9a9f986786ac5af38e9f9bc143233aea32306d4a9c0ec727f7fb', index: 1, amount: '3488319', addressId: 1, walletId: 1, script: 'script2', spentTxHash: null, status: 1, createdAt: '2018-02-28 00:28:09', spentAt: null },
      { id: 333333, blockHeight: 511257, txHash: '02e7c92e569ebf319a52a1f07fd115509a73968fcf4c3b6420f5522c3c65ea83', index: 0, amount: '2141632000', addressId: 1, walletId: 1, script: 'script3', spentTxHash: null, status: 1, createdAt: '2018-02-28 00:28:09', spentAt: null },
      // Other
      { id: 999999, blockHeight: 511280, txHash: '61c7e267f63f7bbd68d90eb27b467ff9265c8368472316fc4d263bcaf109dfc9', index: 6, amount: '3010249', addressId: 4, walletId: 1, script: 'script2', spentTxHash: null, status: 1, createdAt: '2018-02-28 00:28:09', spentAt: null },
      // Unspent of other wallet
      { id: 777777, blockHeight: 511280, txHash: '61c7e267f63f7bbd68d90eb27b467ff9265c8368472316fc4d263bcaf109dfc9', index: 1, amount: '3010249', addressId: 5, walletId: 2, script: 'script2', spentTxHash: null, status: 1, createdAt: '2018-02-28 00:28:09', spentAt: null },
    ]);
    // Setup block
    await db.batchInsert('btc_blocks', [
      { hash: '00000000000000000050c5e9a59eb673d0f84788cd88b53f224116277ff746f1', height: 511296, fee: 50, createdAt: '2018-02-28 08:59:19' },
      { hash: '00000000000000000003382a614c3461e6f3e5f50f1f3add09293a4b396eac95', height: 511297, fee: 40, createdAt: '2018-02-28 09:02:31' }
    ]);
  });

  afterEach(async function () {
    await db.destroy();
  });

  describe('#start', function () {
    it('should start running', function (done) {
      container.register('btcSleepTime', awilix.asValue(0.01));
      const btcMonitor = container.resolve('btcMonitor');
      btcMonitor.run = function() {
        btcMonitor.isRunning.should.equal(true);
        btcMonitor.canStop.should.equal(false);
        btcMonitor.stop();
        done();
      }
      btcMonitor.start();
    });
  });

  describe('#run', function () {
    context('when new block on network', function () {
      it('should process new blocks', function (done) {
        let blockHeight = 511304;
        const rpc = {
          async getLatestBlockHeight() {
            return blockHeight;
          }
        }
        container.register('btcRpc', awilix.asValue(rpc));
        // 10ms
        container.register('btcSleepTime', awilix.asValue(0.01));
        const btcMonitor = container.resolve('btcMonitor');
        // Stub method
        btcMonitor.processBlock = async function (blockHeight, isFastForward) {
          if (isFastForward) {
            blockHeight.should.equal(511304);
          } else {
            blockHeight.should.equal(511298);
          }
        };
        setTimeout(async function () {
          await btcMonitor.stop();
          done();
        }, 50);
        btcMonitor.start();
      });
    });

    context('when no new block', function () {
      it('should wait', async function () {
        let blockHeight = 511303;
        const rpc = {
          async getLatestBlockHeight() {
            return blockHeight;
          }
        }
        container.register('btcRpc', awilix.asValue(rpc));
        // 10ms
        container.register('btcSleepTime', awilix.asValue(0.01));
        const btcMonitor = container.resolve('btcMonitor');
        // Stub method
        btcMonitor.processBlock = async function (blockHeight, isFastForward) {
          if (isFastForward) {
            blockHeight.should.equal(511303);
          } else {
            throw Error('Should not call');
          }
        };
        setTimeout(function () {
          btcMonitor.stop();
        }, 50);
        await btcMonitor.start();
      });
    });
  });

  describe('#processBlock', function () {
    const block511302Hash = '00000000000000000054b9c867e9b7fa465e65fbf259fe067723f43b13f12457';
    const block511302Data = fs.readFileSync(path.join(__dirname, 'btc_block_511302.txt'), 'utf-8');
    const rpc = {
      async getBlockHashByHeight(height) {
        height.should.equal(511302);
        return block511302Hash;
      },
      async getBlock(blockHash, raw) {
        blockHash.should.equal(block511302Hash);
        raw.should.be.true;
        return block511302Data;
      }
    };

    context('when normal deposit', function () {
      it('should process new block: add block, add pending, mark spent, comfirmed and unconfirmed txout, emit balances hash', async function () {
        this.timeout(20000);
        // Read block 511302 00000000000000000054b9c867e9b7fa465e65fbf259fe067723f43b13f12457
        const { preTxOutsCount } = await db('btc_tx_outs').count('id as preTxOutsCount').first();
        container.register('btcRpc', awilix.asValue(rpc));
        const btcMonitor = container.resolve('btcMonitor');
        // Wait for balance hash
        let called = 0;
        btcMonitor.on('block', b => {
          b.hash.should.equal(block511302Hash);
          b.height.should.equal(511302);
          b.balancesHash['BTC']['34Vg65FPmhhnX3D5v1v6rhjmTXzXypgZoY']['37565b3b2ad2626bec5538888b2cb2fd2dbdcce26414d34721a964d83a69995d'].should.equal('0.06078898');
          expect(b.balancesHash['BTC']['3AQUXRuCLxvapAQ9u62uWpLCpJKmd2GLY2']).to.be.undefined;
          b.confirmedNetworkTxs['BTC'].length.should.equal(0);
          called++;
        });
        await btcMonitor.processBlock(511302, false);
        // Event should throw 1 time
        called.should.equal(1);
        // Check new pending
        const { postTxOutsCount } = await db('btc_tx_outs').count('id as postTxOutsCount').first();
        postTxOutsCount.should.equal(preTxOutsCount + 2);
        const pendingTxOut = await db('btc_tx_outs')
          .where('blockHeight', 511302)
          .where('txHash', '37565b3b2ad2626bec5538888b2cb2fd2dbdcce26414d34721a964d83a69995d')
          .where('index', 0)
          .first();
        pendingTxOut.amount.should.equal(6078898);
        pendingTxOut.addressId.should.equal(5);
        pendingTxOut.walletId.should.equal(2);
        pendingTxOut.script.should.equal('a9141ec33e681deb50d8f3069c410fe752f89a3a64b387');
        expect(pendingTxOut.spentTxHash).to.be.null;
        expect(pendingTxOut.spentAt).to.be.null;
        pendingTxOut.status.should.equal(1);
        // Check mark spent
        const spentTxOut = await db('btc_tx_outs')
          .where('txHash', '61c7e267f63f7bbd68d90eb27b467ff9265c8368472316fc4d263bcaf109dfc9')
          .where('index', 1)
          .first();
        spentTxOut.status.should.equal(-1);
        spentTxOut.spentAt.should.not.be.null;
        spentTxOut.spentAtBlockHeight.should.equal(511302);
        // Check block
        const block = await db('btc_blocks').where('height', 511302).first();
        block.hash.should.equal('00000000000000000054b9c867e9b7fa465e65fbf259fe067723f43b13f12457');
        block.fee.should.equal(41);
      });
    });

    context('when fast deposit', function () {
      it('should mark network txs confirmed', async function () {
        this.timeout(10000);
        await db.batchInsert('btc_bundles', [
          { txHash: '330402bae614d380df4e3c86f6b52bc6cc36db55249ad1ab0832e34c0f54ee6d', content: '{}', status: 0, createdAt: '2018-02-28 09:02:31' }
        ]);
        container.register('btcRpc', awilix.asValue(rpc));
        const btcMonitor = container.resolve('btcMonitor');
        // Wait for balance hash
        let called = 0;
        btcMonitor.on('block', b => {
          b.hash.should.equal(block511302Hash);
          b.height.should.equal(511302);
          b.balancesHash['BTC'].should.deep.equal({});
          b.confirmedNetworkTxs['BTC'].should.include('330402bae614d380df4e3c86f6b52bc6cc36db55249ad1ab0832e34c0f54ee6d');
          b.confirmedNetworkTxs['BTC'].length.should.equal(1);
          called++;
        });
        await btcMonitor.processBlock(511302, true);
        // Event should throw 1 time
        called.should.equal(1);
        const bundle = await db('btc_bundles').where('txHash', '330402bae614d380df4e3c86f6b52bc6cc36db55249ad1ab0832e34c0f54ee6d').first();
        bundle.status.should.equal(1);
        bundle.confirmedBlockHeight.should.equal(511302);
        bundle.confirmedAt.should.not.be.null;
      });
    });

    context('when nothing new', function () {
      it('should not emit block event', async function () {
        this.timeout(10000);
        container.register('btcRpc', awilix.asValue(rpc));
        const btcMonitor = container.resolve('btcMonitor');
        // Wait for balance hash
        btcMonitor.on('block', b => {
          throw Error('Should not call');
        });
        await btcMonitor.processBlock(511302, true);
      });
    });
  });

  describe('#calculateNetworkFee', function () {
    context('when more then one transactions in block', function () {
      it('should return avg fee', async function () {
        const block511302Data = fs.readFileSync(path.join(__dirname, 'btc_block_511302.txt'), 'utf-8');
        const block = bitcoin.Block.fromHex(block511302Data);
        const btcMonitor = container.resolve('btcMonitor');
        btcMonitor.constructor.calculateNetworkFee(block, 511302).should.equal(41);
      });
    });

    context('when no transaction in block (exclude coinbase)', function () {
      it('should return 0', async function () {
        const block511302Data = fs.readFileSync(path.join(__dirname, 'btc_block_526562.txt'), 'utf-8');
        const block = bitcoin.Block.fromHex(block511302Data);
        const btcMonitor = container.resolve('btcMonitor');
        btcMonitor.constructor.calculateNetworkFee(block, 526562).should.equal(0);
      });
    });
  });

  describe('#getBlockReward', function () {
    it('should return right block reward', function () {
      const btcMonitor = container.resolve('btcMonitor');
      btcMonitor.constructor.getBlockReward(0).toNumber().should.equal(50 * 10 ** 8);
      btcMonitor.constructor.getBlockReward(1).toNumber().should.equal(50 * 10 ** 8);
      btcMonitor.constructor.getBlockReward(210001).toNumber().should.equal(25 * 10 ** 8);
      btcMonitor.constructor.getBlockReward(525000).toNumber().should.equal(12.5 * 10 ** 8);
      btcMonitor.constructor.getBlockReward(630000).toNumber().should.equal(6.25 * 10 ** 8);
      btcMonitor.constructor.getBlockReward(6930000).toNumber().should.equal(0);
    });
  });
});
