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

describe('BtcService', function () {
  let container, db;

  beforeEach(async function () {
    this.timeout(10000);
    container = createContainer();
    container.register('btcMaximumInput', awilix.asValue(250));
    container.register('btcMaximumFee', awilix.asValue(100000000));
    container.register('btcMaximumFeePerByte', awilix.asValue(50));
    container.register('btcAverageFeeBlocks', awilix.asValue(10));
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

  describe('#addWallet', function () {
    context('when enough xpubs and minimum keys', function() {
      it('should create wallet', async function () {
        const btcService = container.resolve('btcService');
        // bitcoin.HDNode.fromSeedBuffer(Buffer.from('1'.repeat(64))).toBase58();
        // bitcoin.HDNode.fromSeedBuffer(Buffer.from('2'.repeat(64))).toBase58();
        const xpubs = [
          'xpub661MyMwAqRbcFzxKXEGUQVtkWvymtRdwuWVcwC6y1y8Se9bT9boBDpqxK3f4s5rYku3ZKQ1KR7oSEqZ3NZubWgBim9dBpUuwFKeno5jfgLz',
          'xpub661MyMwAqRbcFRK8t5Y6YawvWb2X6WFKf9AefEbNKbRpFBnmGNiaNhYaF95HNfw4a1bC1fJLGywEQeoJroBHC168R1z5wN4bGnb3HVNEGSG'
        ];
        const minimum = 1;
        const result = await btcService.addWallet({ currency: 'BTC', xpubs, minimum });
        result.id.should.equal(4);
        result.changeAddress.should.equal('35vDMfNse8K7YNVQnzTTkQ6f2bSakCYMHD');
        const row = await db('btc_wallets').where('id', 4).first();
        row.xpubs.should.equal(xpubs.join(','));
        row.minimum.should.equal(minimum);
      });
    });

    context('when number of public keys less than minimum keys to unlock', function () {
      it('should throw error', async function () {
        const btcService = container.resolve('btcService');
        // bitcoin.HDNode.fromSeedBuffer(Buffer.from('1'.repeat(64))).toBase58();
        // bitcoin.HDNode.fromSeedBuffer(Buffer.from('2'.repeat(64))).toBase58();
        const xpubs = [
          'xpub661MyMwAqRbcFzxKXEGUQVtkWvymtRdwuWVcwC6y1y8Se9bT9boBDpqxK3f4s5rYku3ZKQ1KR7oSEqZ3NZubWgBim9dBpUuwFKeno5jfgLz',
          'xpub661MyMwAqRbcFRK8t5Y6YawvWb2X6WFKf9AefEbNKbRpFBnmGNiaNhYaF95HNfw4a1bC1fJLGywEQeoJroBHC168R1z5wN4bGnb3HVNEGSG'
        ];
        const minimum = 3;
        await btcService.addWallet({ currency: 'BTC', xpubs, minimum }).should.be.rejectedWith(Error, 'Number of public keys less than minimum keys to unlock');
      });
    });

  });

  describe('#getAddress', function () {
    context('when address not exists', function () {
      it('should create new address for 2 of 2 wallet', async function () {
        const btcService = container.resolve('btcService');
        const { hash, minimum } = await btcService.getAddress({ currency: 'BTC', walletId: 1, path: '0/1', type: 0 });
        hash.should.equal('3HUaFoGtK4yUYFMqc7WWVWvFmXkdtL2ZWA');
      });

      it('should create new address for 2 of 3 wallet', async function () {
        const btcService = container.resolve('btcService');
        const { hash } = await btcService.getAddress({ currency: 'BTC', walletId: 2, path: '0/1', type: 0 });
        hash.should.equal('3DgfNwAJ64BtC11UPa39pVTYafKSNvyQvs');
      });

      it('should create new address for single-sig wallet', async function () {
        const btcService = container.resolve('btcService');
        const { hash } = await btcService.getAddress({ currency: 'BTC', walletId: 3, path: '0/0/123', type: 0 });
        hash.should.equal('17dT8G5PJQDYZAnqMaGWsqGbWpWS2ckstQ');
      });
    });

    context('when address exists', function() {
      it('should return existed address with one wallet 2 of 2 and path', async function () {
        const btcService = container.resolve('btcService');
        await db('btc_addresses').insert({
          walletId: 1,
          path: '0/1',
          hash: '3HUaFoGtK4yUYFMqc7WWVWvFmXkdtL2ZWA'
        });
        const { hash } = await btcService.getAddress({ currency: 'BTC', walletId: 1, path: '0/1', type: 0 });
        hash.should.equal('3HUaFoGtK4yUYFMqc7WWVWvFmXkdtL2ZWA');
        // No new address add
        const { count } = await db('btc_addresses').count('id as count').first();
        count.should.equal(6);
      });
    });

    context('when not exist wallet id', function () {
      it('should throw error', async function () {
        const btcService = container.resolve('btcService');
        // Wallet 10 not exist
        await btcService.getAddress({ currency: 'BTC', walletId: 10, path: '0/1', type: 0 }).should.be.rejectedWith(Error, 'Wallet not found');
      });
    });

    context('when empty path', function () {
      it('should throw error', async function () {
        const btcService = container.resolve('btcService');
        await btcService.getAddress({ currency: 'BTC', walletId: 1, path: '', type: 0 }).should.be.rejectedWith(Error, 'Path empty');
      });
    });

  });

  describe('#bundleTransactions', function () {
    // Check output, input, change, successful withdrawal requests list
    context('when sufficient fund for all withdrawal requests', function () {
      it('should build payload', async function () {
        const btcService = container.resolve('btcService');
        const { payload } = await btcService.bundleTransactions({
          walletId: 1,
          transactions: [
            { id: 123, toAddress: '112YguSv8vUoSLS3kUviTo6QJWAzhHJvWL', grossAmount: '0.00002' },
            { id: 456, toAddress: '1CUkevnKuVJErLqdbiDwjrsfnYeUdEoVtS', grossAmount: '0.00001' },
            { id: 789, toAddress: '3MForezcpZXK28xDCXqoxEX64uCPhHu5qk', grossAmount: '20.41633' }
          ]
        });

        const data = JSON.parse(payload);
        // success_transactions
        data.success_transactions.length.should.equal(3);
        data.success_transactions.should.include(123);
        data.success_transactions.should.include(456);
        data.success_transactions.should.include(789);
        // inputs
        data.inputs.length.should.equal(2);
        data.inputs.should.deep.include({
          id: 222222,
          transaction_hash: '9046ea3d7b1e9a9f986786ac5af38e9f9bc143233aea32306d4a9c0ec727f7fb',
          output_index: 1,
          amount: '3488319',
          hd_path: '0/2',
          script: 'script2'
        });
        data.inputs.should.deep.include({
          id: 333333,
          transaction_hash: '02e7c92e569ebf319a52a1f07fd115509a73968fcf4c3b6420f5522c3c65ea83',
          output_index: 0,
          amount: '2141632000',
          hd_path: '0/2',
          script: 'script3'
        });
        // outputs
        data.outputs.length.should.equal(4);
        data.outputs.should.deep.include({
          amount: '2000',
          address: '112YguSv8vUoSLS3kUviTo6QJWAzhHJvWL'
        });
        data.outputs.should.deep.include({
          amount: '1000',
          address: '1CUkevnKuVJErLqdbiDwjrsfnYeUdEoVtS'
        });
        data.outputs.should.deep.include({
          amount: '2041633000',
          address: '3MForezcpZXK28xDCXqoxEX64uCPhHu5qk'
        });
        // change
        data.outputs.should.deep.include({
          amount: '103484319',
          address: '3AQUXRuCLxvapAQ9u62uWpLCpJKmd2GLY2',
          change: true
        });
        // fee per kb
        data.fee_per_kb.should.equal(45 * 1024);
      });
    });

    context('when sufficient fund for at least 1 withdrawal requests', function () {
      it('should build payload', async function () {
        const btcService = container.resolve('btcService');
        const { payload } = await btcService.bundleTransactions({
          walletId: 1,
          transactions: [
            { id: 123, toAddress: '112YguSv8vUoSLS3kUviTo6QJWAzhHJvWL', grossAmount: '20.00002' },
            { id: 456, toAddress: '1CUkevnKuVJErLqdbiDwjrsfnYeUdEoVtS', grossAmount: '10.00001' },
            { id: 789, toAddress: '3MForezcpZXK28xDCXqoxEX64uCPhHu5qk', grossAmount: '21.41633' }
          ]
        });

        const data = JSON.parse(payload);
        // success_transactions
        data.success_transactions.length.should.equal(1);
        data.success_transactions.should.include(123);
        // inputs
        data.inputs.length.should.equal(1);
        data.inputs.should.deep.include({
          id: 333333,
          transaction_hash: '02e7c92e569ebf319a52a1f07fd115509a73968fcf4c3b6420f5522c3c65ea83',
          output_index: 0,
          amount: '2141632000',
          hd_path: '0/2',
          script: 'script3'
        });
        // outputs
        data.outputs.length.should.equal(2);
        data.outputs.should.deep.include({
          amount: '2000002000',
          address: '112YguSv8vUoSLS3kUviTo6QJWAzhHJvWL'
        });
        // change
        data.outputs.should.deep.include({
          amount: '141630000',
          address: '3AQUXRuCLxvapAQ9u62uWpLCpJKmd2GLY2',
          change: true
        });
        // fee per kb
        data.fee_per_kb.should.equal(45 * 1024);
      });
    });

    context('when insufficient fund for all requests', function () {
      it('should throw error', async function () {
        const btcService = container.resolve('btcService');
        await btcService.bundleTransactions({
          walletId: 1,
          transactions: [
            { id: 123, toAddress: '112YguSv8vUoSLS3kUviTo6QJWAzhHJvWL', grossAmount: '50.00002' },
            { id: 456, toAddress: '1CUkevnKuVJErLqdbiDwjrsfnYeUdEoVtS', grossAmount: '40.00001' },
            { id: 789, toAddress: '3MForezcpZXK28xDCXqoxEX64uCPhHu5qk', grossAmount: '32.41633' }
          ]
        }).should.be.rejectedWith(Error, 'Insufficient fund');
      });
    });

    context('when non-exist wallet id', function () {
      it('should throw error', async function () {
        const btcService = container.resolve('btcService');
        await btcService.bundleTransactions({
          walletId: 5,
          transactions: [
            { id: 123, toAddress: '112YguSv8vUoSLS3kUviTo6QJWAzhHJvWL', grossAmount: '21.00002' },
            { id: 456, toAddress: '1CUkevnKuVJErLqdbiDwjrsfnYeUdEoVtS', grossAmount: '10.00001' },
            { id: 789, toAddress: '3MForezcpZXK28xDCXqoxEX64uCPhHu5qk', grossAmount: '21.41633' }
          ]
        }).should.be.rejectedWith(Error, 'Wallet not found');
      });
    });

  });

  describe('#getFee', function () {
    it('should return latest fee below maximum', async function () {
      const btcService = container.resolve('btcService');
      (await btcService.getFee()).should.equal(45);
    });

    it('should return cap latest fee above maximum', async function () {
      const btcService = container.resolve('btcService');
      await db.batchInsert('btc_blocks', [
        { hash: '00000000000000000056bbdfbafebdc8df3aace688441b49b16b1c6cb52c47a7', height: 511298, fee: 60, createdAt: '2018-02-28 08:59:19' },
      ]);
      (await btcService.getFee()).should.equal(50);
    });

    it('should return cap latest fee above maximum', async function () {
      const btcService = container.resolve('btcService');
      // Remove all block
      await db('btc_blocks').del();
      (await btcService.getFee()).should.equal(50);
    });
  });

  describe('#getStatus', function () {
    context('when have txouts', function () {
      it('should return status', async function () {
        const btcService = container.resolve('btcService');
        await db.batchInsert('btc_tx_outs', [
          { id: 888888, blockHeight: 511280, txHash: '61c7e267f63f7bbd68d90eb27b467ff9265c8368472316fc4d263bcaf109dfc9', index: 7, amount: '200000', addressId: 4, walletId: 1, script: 'script2', spentTxHash: null, status: 0, createdAt: '2018-02-28 00:28:09', spentAt: null },
        ]);
        const { totalBalance, availableBalance, availableWithdrawal } = await btcService.getStatus({ currency: 'BTC', walletId: 1 });
        totalBalance.should.equal('21.48330568');
        availableBalance.should.equal('21.48130568');
        availableWithdrawal.should.equal('21.48130568');
      });
    })

    context('when have no txouts', function () {
      it('should return status with 0 value', async function () {
        const btcService = container.resolve('btcService');
        const { totalBalance, availableBalance, availableWithdrawal } = await btcService.getStatus({ currency: 'BTC', walletId: 3 });
        totalBalance.should.equal('0');
        availableBalance.should.equal('0');
        availableWithdrawal.should.equal('0');
      });
    });
  });

  describe('#broadcast', function () {
    context('when right JSON and payload hex', function () {
      it('should broadcast payload and mark txouts pending', async function () {
        const data = fs.readFileSync(path.join(__dirname, 'btc_signed_payload.json'), 'utf-8');
        const payload = JSON.parse(data);
        const txHash = 'fe688b554c5be46cb4f29fcb766cb21af5970bbec28f44f1472fa63f661fe418';
        // Insert txout into db
        await db.batchInsert('btc_tx_outs', [
          { blockHeight: 123, txHash: '659b8bb99ae0157806b5aa6267986ede5bb32fc714b7f7aab968550ff708af50', index: 0, amount: 123, addressId: 1, walletId: 1, script: '', status: 1, spentTxHash: null, spentAt: null },
          { blockHeight: 123, txHash: '90f484e052a1769345d50db9d911e8f4041817f060455337c95d7b35cda0ffc5', index: 78, amount: 123, addressId: 1, walletId: 1, script: '', status: 1, spentTxHash: null, spentAt: null },
        ]);
        const rpc = {
          async relayTx(hex) {
            hex.should.equal(payload.payload_hex);
          }
        };
        container.register('btcRpc', awilix.asValue(rpc));
        const btcService = container.resolve('btcService');
        const result = await btcService.broadcast({ payload: data });
        const txOut1 = await db('btc_tx_outs').where('txHash', '659b8bb99ae0157806b5aa6267986ede5bb32fc714b7f7aab968550ff708af50').where('index', 0).first();
        txOut1.status.should.equal(0);
        txOut1.spentTxHash.should.equal(txHash);
        txOut1.spentAt.should.be.not.null;
        const txOut2 = await db('btc_tx_outs').where('txHash', '90f484e052a1769345d50db9d911e8f4041817f060455337c95d7b35cda0ffc5').where('index', 78).first();
        txOut2.status.should.equal(0);
        txOut2.spentTxHash.should.equal(txHash);
        txOut2.spentAt.should.be.not.null;
        const resultPayload = JSON.parse(result.payload);
        const hash = 'fe688b554c5be46cb4f29fcb766cb21af5970bbec28f44f1472fa63f661fe418';
        Object.keys(resultPayload).length.should.equal(payload.success_transactions.length);
        payload.success_transactions.forEach((t) => {
          resultPayload[t.toString()].should.equal(hash);
        });
      });
    });

    context('when right wrong JSON', function () {
      it('should throw error', async function () {
        const rpc = {
          async relayTx(hex) {
            throw Error('Should not call');
          }
        };
        container.register('btcRpc', awilix.asValue(rpc));
        const btcService = container.resolve('btcService');
        await btcService.broadcast({ payload: 'abcxyz' }).should.be.rejectedWith(Error);
      });
    });

    context('when right right JSON but wrong payload hex', function () {
      it('should throw error', async function () {
        const rpc = {
          async relayTx(hex) {
            throw Error('Should not call');
          }
        };
        container.register('btcRpc', awilix.asValue(rpc));
        const btcService = container.resolve('btcService');
        await btcService.broadcast({ payload: '{"payload_hex": "abc"}' }).should.be.rejectedWith(Error);
      });
    });
  });

  describe('#validateAddress', function () {
    context('when PKPKH address', function () {
      it('should valid', async function () {
        const btcService = container.resolve('btcService');
        const result = await btcService.validateAddress({
          hash: '17VZNX1SN5NtKa8UQFxwQbFeFc3iqRYhem'
        });
        expect(result.valid).to.be.true;
      });
    });
    context('when P2SH address', function () {
      it('should valid', async function () {
        const btcService = container.resolve('btcService');
        const result = await btcService.validateAddress({
          hash: '3EktnHQD7RiAE6uzMj2ZifT9YgRrkSgzQX'
        });
        expect(result.valid).to.be.true;
      });
    });
    context('when valid address but leading space', function () {
      it('should valid', async function () {
        const btcService = container.resolve('btcService');
        const result = await btcService.validateAddress({
          hash: ' 3EktnHQD7RiAE6uzMj2ZifT9YgRrkSgzQX'
        });
        expect(result.valid).to.be.false;
      });
    });
    context('when testnet address', function () {
      it('should valid', async function () {
        const btcService = container.resolve('btcService');
        let result = await btcService.validateAddress({
          hash: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn'
        });
        expect(result.valid).to.be.false;
        result = await btcService.validateAddress({
          hash: '2MzwalletSnBHWHqSAqtTVQ6v47XtaisrJa1Vc'
        });
        expect(result.valid).to.be.false;
      });
    });
    context('when random string', function () {
      it('should valid', async function () {
        const btcService = container.resolve('btcService');
        const result = await btcService.validateAddress({
          hash: 'abcxyz'
        });
        expect(result.valid).to.be.false;
      });
    });
    context('when empty', function () {
      it('should valid', async function () {
        const btcService = container.resolve('btcService');
        const result = await btcService.validateAddress({
          hash: ''
        });
        expect(result.valid).to.be.false;
      });
    });
  });
});
