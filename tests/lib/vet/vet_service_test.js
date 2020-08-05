const chai = require('chai');
const awilix = require('awilix');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const { create: createContainer } = require('../../../src/container');
const knex = require('knex');
const VetService = require('../../../src/lib/vet/vet_service');
const snakeCaseKeys = require('snakecase-keys');
const Decimal = require('../../../src/lib/vet/vet_utils').decimal();

let container;
let db;

chai.use(chaiAsPromised);
chai.should();

const dummyApiUrl = 'http://dummyapiurl.com';
const chainTag = '0x4a';

const { ERROR_MSG } = VetService;

describe('VetService', function () {
  beforeEach(async function () {
    container = createContainer();

    container.register('vetApiUrl', awilix.asValue(dummyApiUrl));
    container.register('vetApiSleepTime', awilix.asValue(10));
    container.register('vetApiTimeout', awilix.asValue(5000));


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
    const { migrate } = db;
    await migrate.latest();

    await db('vet_wallets').insert({
      xpub: 'xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz',
    });

    await db('vet_addresses').insert({
      type: 'settlement',
      hash: '0xsettlement',
      path: '0/1/0',
      walletId: 1,
    });
  });

  afterEach(async function () {
    const { migrate } = db;
    await migrate.rollback();

    await db.destroy();
  });

  describe('#getAddress(req)', function () {
    context('When `path` is missing', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService
          .getAddress({})
          .should.be.rejectedWith(ERROR_MSG.MISSING_PATH);
      });
    });

    context('When `wallet` is not found', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService
          .getAddress({ walletId: 2, path: '0/0/1' })
          .should.be.rejectedWith(ERROR_MSG.WALLET_NOT_FOUND);

        vetService
          .getAddress({ path: '0/0/1' }) // undefined walletId
          .should.be.rejectedWith(ERROR_MSG.WALLET_NOT_FOUND);
      });
    });

    context('When address is already created', function () {
      it('should return found address', async function () {
        const vetService = container.resolve('vetService');

        await db('vet_addresses').insert({
          hash: '0xabc',
          path: '0/0/1',
          walletId: 1,
        });

        sinon.spy(vetService.addresses, 'add');
        const address = await vetService.getAddress({ walletId: 1, path: '0/0/1' });

        address.should.deep.equal({ hash: '0xabc' });

        vetService.addresses.add.called.should.be.false;
      });
    });

    context('When no address found', function () {
      it('should add new address', async function () {
        const vetService = container.resolve('vetService');

        sinon.spy(vetService.addresses, 'add');
        const address = await vetService.getAddress({ walletId: 1, path: '0/0/1' });

        delete address.id;

        const dbAddress = await db('vet_addresses')
          .where({ path: '0/0/1', walletId: 1 })
          .first();

        dbAddress.hash.should.equal(address.hash);
        dbAddress.path.should.equal('0/0/1');
        dbAddress.walletId.should.equal(1);

        vetService.addresses.add.called.should.be.true;
      });
    });
  });

  describe('#addWallet(req)', function () {
    context('When `xpubs` is missing', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService
          .addWallet({})
          .should.be.rejectedWith(ERROR_MSG.MISSING_XPUB);

        vetService
          .addWallet({ xpubs: [] })
          .should.be.rejectedWith(ERROR_MSG.MISSING_XPUB);
      });
    });

    context('When `xpubs` is provided but wallet is already created', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService.addWallet({
          xpubs: ['xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz'],
          minimum: 1,
        }).should.be.rejectedWith(ERROR_MSG.WALLET_EXISTED);
      });
    });

    context('When `xpubs` is provided and not existed in db', function () {
      it('should create wallet and settlement address', async function () {
        const vetService = container.resolve('vetService');

        const result = await vetService.addWallet({
          xpubs: ['xpub6DUmnoJCKNtBbC2umgixMNVvxN5P2HdjCASAbbHb1Dt3id1gt1h8ucM9Diw32JVbsy4cUvN4VJQpNxQg4z1niUaj1w1iT5B9n27hWuDvBHY'],
          minimum: 1,
        });

        const wallet = await db('vet_wallets').where({
          xpub: 'xpub6DUmnoJCKNtBbC2umgixMNVvxN5P2HdjCASAbbHb1Dt3id1gt1h8ucM9Diw32JVbsy4cUvN4VJQpNxQg4z1niUaj1w1iT5B9n27hWuDvBHY',
        }).first();

        result.should.deep.equal({
          id: wallet.id,
          changeAddress: '0xa0ca743d3a901b021e85d0e1671e90273be40957',
          feeAddress: '',
        });
      });
    });
  });

  describe('#validateAddress(req)', function () {
    context('When `hash` is missing', function () {
      it('should return valid = false', async function () {
        const vetService = container.resolve('vetService');

        const result = await vetService.validateAddress({});
        result.should.deep.equal({ valid: false });
      });
    });

    context('when `hash` is valid', function () {
      it('should return valid = true', async function () {
        const vetService = container.resolve('vetService');

        sinon.stub(vetService.api, 'getAccount').returns({
          balance: '0x0',
          energy: '0x0',
          hasCode: false,
        });

        const result = await vetService.validateAddress({ hash: '0xdbcf7f79e8e388bf3315e27e07c2e41eabddf90b' });
        result.should.deep.equal({ valid: true });
      });
    });

    context('when `hash` is invalid', function () {
      it('should return valid = false', async function () {
        const vetService = container.resolve('vetService');

        sinon.stub(vetService.api, 'getAccount').returns(null);

        const result = await vetService.validateAddress({ hash: '0xdbcf7f79e8e388bf3315e27e07c2e41eabddf90baa' });
        result.should.deep.equal({ valid: false });

        vetService.api.getAccount.restore();
        sinon.stub(vetService.api, 'getAccount').throws();

        const result2 = await vetService.validateAddress({ hash: '0xdbcf7f79e8e388bf3315e27e07c2e41eabddf90baa' });
        result2.should.deep.equal({ valid: false });
      });
    });
  });

  describe('#bundleMoveFund({ walletId, currency })', function () {
    context('When `walletId` is missing', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService
          .bundleMoveFund({})
          .should.be.rejectedWith(ERROR_MSG.MISSING_WALLET_ID);
      });
    });

    context('When `currency` is missing', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService
          .bundleMoveFund({ walletId: 1 })
          .should.be.rejectedWith(ERROR_MSG.MISSING_CURRENCY);
      });
    });

    context('When all arguments are provided', function () {
      it('should work', async function () {
        const vetService = container.resolve('vetService');

        const result = await vetService.addWallet({
          xpubs: ['xpub6DUmnoJCKNtBbC2umgixMNVvxN5P2HdjCASAbbHb1Dt3id1gt1h8ucM9Diw32JVbsy4cUvN4VJQpNxQg4z1niUaj1w1iT5B9n27hWuDvBHY'],
          minimum: 1,
        });

        const walletId = result.id;

        await db('vet_transactions').insert([{
          id: 1,
          type: 'funding',
          walletId: result.id,
          fromAddress: '0xabc',
          toAddress: '0xcva',
          toPath: '0/0/1',
          grossAmount: '1000000',
          hash: '0xabc',
          clauseIndex: 1,
          currency: 'VET',
        }, {
          id: 2,
          type: 'funding',
          walletId: result.id,
          fromAddress: '0xabc2',
          toAddress: '0xcva3',
          toPath: '0/0/1',
          grossAmount: '2000000',
          hash: '0xabc2',
          clauseIndex: 1,
          currency: 'VET',
        }, {
          id: 3,
          type: 'funding',
          walletId: result.id,
          fromAddress: '0xabc3',
          toAddress: '0xcva2',
          toPath: '0/0/1',
          grossAmount: '3000000',
          hash: '0xabc3',
          clauseIndex: 1,
          currency: 'VET',
        }]);

        const output = await vetService.bundleMoveFund({ walletId, currency: 'VET' });

        output.should.deep.equal({
          bundledTxs: [{
            id: 1,
            grossAmount: new Decimal('1000000').div('1e18').toFixed(),
            fromPath: '0/0/1',
            toPath: vetService.addresses.SETTLEMENT_PATH,
          }, {
            id: 2,
            grossAmount: new Decimal('2000000').div('1e18').toFixed(),
            fromPath: '0/0/1',
            toPath: vetService.addresses.SETTLEMENT_PATH,
          }, {
            id: 3,
            grossAmount: new Decimal('3000000').div('1e18').toFixed(),
            fromPath: '0/0/1',
            toPath: vetService.addresses.SETTLEMENT_PATH,
          }],
          estimatedGas: 21000 });
      });
    });
  });

  describe('#bundleWithdrawal({ settlement, transactions })', function () {
    context('When `walletId` is missing', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService
          .bundleWithdrawal({})
          .should.be.rejectedWith(ERROR_MSG.MISSING_WALLET_ID);
      });
    });

    context('When `transactions` is missing', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService
          .bundleWithdrawal({ walletId: 1 })
          .should.be.rejectedWith(ERROR_MSG.MISSING_TRANSACTIONS);
      });
    });

    context('When `settlement` is not found', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService
          .bundleWithdrawal({ walletId: 1000, transactions: [] })
          .should.be.rejectedWith(ERROR_MSG.SETTLEMENT_NOT_FOUND);
      });
    });

    context('When gas is null', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        const dummyTxs = [{
          id: 1,
          toAddress: '0xabc',
          grossAmount: '30',
        }, {
          id: 2,
          toAddress: '0xabc2',
          grossAmount: '50',
        }];

        sinon
          .stub(vetService.api, 'getEnergy').returns(null);

        vetService
          .bundleWithdrawal({ walletId: 1, transactions: dummyTxs })
          .should.be.rejectedWith(ERROR_MSG.SETTLEMENT_INSUFFICIENT_GAS);
      });
    });

    context('When settlement gas is not enough for a portion transactions', function () {
      it('should bundle a portion of transactions', async function () {
        const vetService = container.resolve('vetService');
        const dummyTxs = [{
          id: 1,
          toAddress: '0xabc',
          grossAmount: '30',
        }, {
          id: 2,
          toAddress: '0xabc2',
          grossAmount: '50',
        }];

        sinon
          .stub(vetService.api, 'getEnergy')
          .returns('36000000000000000000');

        const bundle = await vetService.bundleWithdrawal({ walletId: 1, transactions: dummyTxs });

        bundle.should.deep.equal({
          bundledTxs: [{
            id: 1,
            toAddress: '0xabc',
            fromPath: vetService.addresses.SETTLEMENT_PATH,
            grossAmount: new Decimal('30000000000000000000').div('1e18').toString(),
          }],
          estimatedGas: 21000,
        });
      });
    });

    context('When settlement gas is not enough for all transactions', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');
        const dummyTxs = [{
          id: 1,
          toAddress: '0xabc',
          grossAmount: '30',
        }, {
          id: 2,
          toAddress: '0xabc2',
          grossAmount: '50',
        }];

        sinon
          .stub(vetService.api, 'getEnergy')
          .returns('12000000000000000000');

        vetService
          .bundleWithdrawal({ walletId: 1, transactions: dummyTxs })
          .should.be.rejectedWith(ERROR_MSG.SETTLEMENT_INSUFFICIENT_GAS);
      });
    });

    context('When settlement gas is sufficient', function () {
      it('should bundle transactions', async function () {
        const vetService = container.resolve('vetService');
        const dummyTxs = [{
          id: 1,
          toAddress: '0xabc',
          grossAmount: '30',
        }, {
          id: 2,
          toAddress: '0xabc2',
          grossAmount: '50',
        }];

        sinon
          .stub(vetService.api, 'getEnergy')
          .returns('42000000000000000000');

        const result = await vetService
          .bundleWithdrawal({ walletId: 1, transactions: dummyTxs });

        result.should.deep.equal({
          bundledTxs: [{
            id: 1,
            toAddress: '0xabc',
            fromPath: vetService.addresses.SETTLEMENT_PATH,
            grossAmount: new Decimal('30000000000000000000').div('1e18').toString(),
          }, {
            id: 2,
            toAddress: '0xabc2',
            fromPath: vetService.addresses.SETTLEMENT_PATH,
            grossAmount: new Decimal('50000000000000000000').div('1e18').toString(),
          }],
          estimatedGas: 37000 });
      });
    });
  });

  describe('#bundleTransactions(req)', function () {
    context('When `walletId` is missing', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService
          .bundleTransactions({ type: 'move_fund', transactions: [] })
          .should.be.rejectedWith(ERROR_MSG.WALLET_ID_MISSING);
      });
    });

    context('When `latestBlock` is not found', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        const result = await vetService.addWallet({
          xpubs: ['xpub6DUmnoJCKNtBbC2umgixMNVvxN5P2HdjCASAbbHb1Dt3id1gt1h8ucM9Diw32JVbsy4cUvN4VJQpNxQg4z1niUaj1w1iT5B9n27hWuDvBHY'],
          minimum: 1,
        });

        vetService
          .bundleTransactions({ type: 'move_fund', transactions: [], walletId: result.id })
          .should.be.rejectedWith(ERROR_MSG.BLOCK_NOT_FOUND);
      });
    });

    context('When `type` is not of defined type', function () {
      it('should return bundle with empty transactions', async function () {
        const vetService = container.resolve('vetService');

        await db('vet_blocks').insert({
          height: 334626,
          hash: '0x00051b223820cb7ef74bddaea04e606cc3ee2c428fa47e46de11a1814b789f9e',
        });

        const result = await vetService.addWallet({
          xpubs: ['xpub6DUmnoJCKNtBbC2umgixMNVvxN5P2HdjCASAbbHb1Dt3id1gt1h8ucM9Diw32JVbsy4cUvN4VJQpNxQg4z1niUaj1w1iT5B9n27hWuDvBHY'],
          minimum: 1,
        });

        const bundled = await vetService
          .bundleTransactions({ type: 'random_type', transactions: [], walletId: result.id });

        bundled.should.deep.equal({
          payload: JSON.stringify(snakeCaseKeys({
            transactions: [],
            meta: {
              blockRef: '0x00051b223820cb7e',
              chainTag,
              type: 'random_type',
              walletId: result.id,
            },
          })),
        });
      });
    });

    context('When all arguments are valid', function () {
      it('should work', async function () {
        const vetService = container.resolve('vetService');
        const result = await vetService.addWallet({
          xpubs: ['xpub6DUmnoJCKNtBbC2umgixMNVvxN5P2HdjCASAbbHb1Dt3id1gt1h8ucM9Diw32JVbsy4cUvN4VJQpNxQg4z1niUaj1w1iT5B9n27hWuDvBHY'],
          minimum: 1,
        });

        await db('vet_blocks').insert({
          height: 334626,
          hash: '0x00051b223820cb7ef74bddaea04e606cc3ee2c428fa47e46de11a1814b789f9e',
        });

        sinon
          .stub(vetService.api, 'getEnergy')
          .returns('42000000000000000000');
        sinon.spy(vetService, 'bundleMoveFund');
        sinon.spy(vetService, 'bundleWithdrawal');

        const bundleMoveFund = await vetService
          .bundleTransactions({ type: 'move_fund', transactions: [], walletId: result.id, currency: 'VET' });

        bundleMoveFund.should.deep.equal({
          payload: JSON.stringify(snakeCaseKeys({
            transactions: [],
            meta: {
              gasPrice: 0,
              blockRef: '0x00051b223820cb7e',
              chainTag,
              type: 'move_fund',
              walletId: result.id,
            },
          })) });

        vetService.bundleMoveFund.calledOnce.should.be.true;
        vetService.bundleWithdrawal.called.should.be.false;

        const bundleWithdrawal = await vetService
          .bundleTransactions({
            type: 'withdrawal',
            transactions: [{
              id: 1,
              toAddress: '0xabc',
              grossAmount: '30',
            }, {
              id: 2,
              toAddress: '0xabc2',
              grossAmount: '50',
            }],
            walletId: result.id,
            currency: 'VET',
          });

        bundleWithdrawal.should.deep.equal({
          payload: JSON.stringify(snakeCaseKeys({
            transactions: [{
              id: 1,
              toAddress: '0xabc',
              grossAmount: new Decimal('30000000000000000000').div('1e18').toString(),
              fromPath: '0/1/0',
            }, {
              id: 2,
              toAddress: '0xabc2',
              grossAmount: new Decimal('50000000000000000000').div('1e18').toString(),
              fromPath: '0/1/0',
            }],
            meta: {
              gasPrice: 37000,
              blockRef: '0x00051b223820cb7e',
              chainTag,
              type: 'withdrawal',
              walletId: result.id,
            },
          })),
        });

        vetService.bundleMoveFund.calledOnce.should.be.true;
        vetService.bundleWithdrawal.calledOnce.should.be.true;
      });
    });
  });

  describe('#broadcast(req)', function () {
    context('When `payload` is missing', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService
          .broadcast({})
          .should.be.rejectedWith(ERROR_MSG.MISSING_PAYLOAD);
      });
    });

    context('When `walletId` or `type` or `transactions` is missing', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService
          .broadcast({ payload: '{}' })
          .should.be.rejectedWith(ERROR_MSG.INVALID_PAYLOAD);

        vetService
          .broadcast({ payload: '{ "walletId": 1, "type": "move-fund" }' })
          .should.be.rejectedWith(ERROR_MSG.INVALID_PAYLOAD);

        vetService
          .broadcast({ payload: '{ "transactions": [], "type": "move-fund" }' })
          .should.be.rejectedWith(ERROR_MSG.INVALID_PAYLOAD);

        vetService
          .broadcast({ payload: '{ "walletId": 1, "transactions": [] }' })
          .should.be.rejectedWith(ERROR_MSG.INVALID_PAYLOAD);
      });
    });

    context('When broadcast move fund failed', function () {
      it('should not include tx hash to `successTxHash`', async function () {
        const vetService = container.resolve('vetService');

        const payload = {
          type: 'move_fund',
          wallet_id: 1,
          transactions_hash: {
            1: '0xabc',
            2: '0xf8384a87052fb057c31c608202d0dfde94020ec4568af7494b38016fd7f9ab7606a851cb4c87038d7ea4c68000808082520880850fae2c7aafc0',
          },
        };

        sinon.stub(vetService.transactions, 'addPendingMoveFund').returns(0);
        sinon
          .stub(vetService.api, 'sendSignedTransaction')
          .callsFake((txRaw) => {
            if (txRaw === '0xabc') return null;
            return '0xdummySignedTransactionHash';
          });

        await vetService.broadcast({ payload: JSON.stringify(payload), currency: 'VET' });
        vetService.transactions.addPendingMoveFund.calledWith({
          broadcastedTxsHash: { 1: '', 2: '0xdummySignedTransactionHash' },
          walletId: 1,
          txHash: {
            1: '0xabc',
            2: '0xf8384a87052fb057c31c608202d0dfde94020ec4568af7494b38016fd7f9ab7606a851cb4c87038d7ea4c68000808082520880850fae2c7aafc0',
          },
          currency: 'VET',
        }).should.be.true;
      });
    });

    context('When broadcast move fund failed', function () {
      it('should not include tx hash to `successTxHash`', async function () {
        const vetService = container.resolve('vetService');

        const payload = {
          type: 'move_fund',
          wallet_id: 1,
          transactions_hash: {
            1: '0xabc',
            2: '0xf8384a87052fb057c31c608202d0dfde94020ec4568af7494b38016fd7f9ab7606a851cb4c87038d7ea4c68000808082520880850fae2c7aafc0',
          },
        };

        sinon.stub(vetService.transactions, 'addPendingMoveFund').returns(0);
        sinon
          .stub(vetService.api, 'sendSignedTransaction')
          .callsFake((txRaw) => {
            if (txRaw === '0xabc') throw Error();
            return '0xdummySignedTransactionHash';
          });

        await vetService
          .broadcast({ payload: JSON.stringify(payload), currency: 'VET' })
          .should.be.rejected;

        vetService.transactions.addPendingMoveFund.calledWith({
          broadcastedTxsHash: { 1: '' },
          walletId: 1,
          txHash: {
            1: '0xabc',
            2: '0xf8384a87052fb057c31c608202d0dfde94020ec4568af7494b38016fd7f9ab7606a851cb4c87038d7ea4c68000808082520880850fae2c7aafc0',
          },
          currency: 'VET',
        }).should.be.true;
      });
    });

    context('When broadcast withdrawal failed', function () {
      it('should not include tx hash to `successTxHash`', async function () {
        const vetService = container.resolve('vetService');

        const payload = {
          type: 'withdrawal',
          wallet_id: 1,
          transactions_hash: {
            123: '0xf8384a87052fb057c31c608202d0dfde94020ec4568af7494b38016fd7f9ab7606a851cb4c87038d7ea4c68000808082520880850fae2c7aafc0',
            124: null,
          },
        };

        sinon.spy(vetService.transactions, 'addPendingMoveFund');
        sinon.stub(vetService.api, 'sendSignedTransaction').returns(null);

        const result = await vetService.broadcast({ payload: JSON.stringify(payload), currency: 'VET' });

        result.should.deep.equal({ payload: '{}' });
      });
    });

    context('When broadcast withdrawal throw error', function () {
      it('should save broadcast tx before throwing error', async function () {
        const vetService = container.resolve('vetService');

        const payload = {
          type: 'withdrawal',
          wallet_id: 1,
          transactions_hash: {
            123: '0xf8384a87052fb057c31c608202d0dfde94020ec4568af7494b38016fd7f9ab7606a851cb4c87038d7ea4c68000808082520880850fae2c7aafc0',
            124: null,
          },
        };

        sinon.spy(vetService.transactions, 'addPendingWithdrawal');
        sinon.stub(vetService.api, 'sendSignedTransaction').throws();

        await vetService
          .broadcast({ payload: JSON.stringify(payload), currency: 'VET' })
          .should.be.rejected;

        vetService.transactions.addPendingWithdrawal.calledWith({
          broadcastedTxsHash: { 123: '' },
          walletId: 1,
          txHash: {
            123: '0xf8384a87052fb057c31c608202d0dfde94020ec4568af7494b38016fd7f9ab7606a851cb4c87038d7ea4c68000808082520880850fae2c7aafc0',
            124: null,
          },
          currency: 'VET',
        }).should.be.true;
      });
    });

    context('When broadcast move fund transactions', function () {
      it('should broadcast and match funding tx with move-fund tx', async function () {
        const vetService = container.resolve('vetService');

        await db('vet_transactions').insert({
          id: 1,
          type: 'funding',
          walletId: 1,
          fromAddress: '0xabc',
          toAddress: '0xcva',
          toPath: '0/0/1',
          grossAmount: '1000000',
          hash: '0xabc',
          clauseIndex: 1,
          currency: 'VET',
        });

        const payload = {
          type: 'move_fund',
          wallet_id: 1,
          transactions_hash: {
            1: '0xf8384a87052fb057c31c608202d0dfde94020ec4568af7494b38016fd7f9ab7606a851cb4c87038d7ea4c68000808082520880850fae2c7aafc0',
          },
        };

        sinon
          .stub(vetService.api, 'sendSignedTransaction')
          .returns('0xdummySignedTransactionHash');

        const result = await vetService.broadcast({ payload: JSON.stringify(payload), currency: 'VET' });

        result.should.deep.equal({ payload: '{}' });

        const fundingTx = await db('vet_transactions').where({ id: 1 }).first();
        const moveFundTx = await db('vet_transactions').where({ hash: '0xdummysignedtransactionhash' }).first();

        fundingTx.moveFundAtTxHash.should.equal('0xdummysignedtransactionhash');
        moveFundTx.should.exist;
      });
    });

    context('When broadcast withdrawal transactions', function () {
      it('should broadcast and return successTxHash', async function () {
        const vetService = container.resolve('vetService');

        const payload = {
          type: 'withdrawal',
          wallet_id: 1,
          transactions_hash: {
            123: '0xf8384a87052fb057c31c608202d0dfde94020ec4568af7494b38016fd7f9ab7606a851cb4c87038d7ea4c68000808082520880850fae2c7aafc0',
            124: null,
          },
        };

        sinon
          .stub(vetService.api, 'sendSignedTransaction')
          .returns('0xdummySignedTransactionHash');

        const result = await vetService.broadcast({ payload: JSON.stringify(payload), currency: 'VET' });

        result.should.deep.equal({ payload: JSON.stringify({
          123: '0xdummySignedTransactionHash',
          124: '0xdummySignedTransactionHash',
        }) });

        const withdrawalTx = await db('vet_transactions').where({ hash: '0xdummysignedtransactionhash' }).first();

        withdrawalTx.should.exist;
        withdrawalTx.type.should.equal('withdrawal');
      });
    });

    context('When broadcast withdrawal transactions but withdrawal bundle is invalid', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        const payload = {
          type: 'withdrawal',
          wallet_id: 1,
          transactions_hash: {
            123: '0xf8384a87052fb057c31c608202d0dfde94020ec4568af7494b38016fd7f9ab7606a851cb4c87038d7ea4c68000808082520880850fae2c7aafc0',
            124: null,
            125: '0xf8384a87052fb057c31c608202d0dfde94020ec4568af7494b38016fd7f9ab7606a851cb4c87038d7ea4c68000808082520880850fae2c7aafc0',
          },
        };

        sinon
          .stub(vetService.api, 'sendSignedTransaction')
          .returns('0xdummySignedTransactionHash');

        vetService
          .broadcast({ payload: JSON.stringify(payload), currency: 'VET' })
          .should.be.rejectedWith(ERROR_MSG.INVALID_WITHDRAWAL_BUNDLE);
      });
    });
  });

  describe('#getStatus(req)', function () {
    context('When `currency` is missing', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService
          .getStatus({})
          .should.be.rejectedWith(ERROR_MSG.MISSING_CURRENCY);
      });
    });

    context('When `walletId` is missing', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService
          .getStatus({ currency: 'VET' })
          .should.be.rejectedWith(ERROR_MSG.MISSING_WALLET_ID);
      });
    });

    context('When `walletId` is missing', function () {
      it('should throw error', async function () {
        const vetService = container.resolve('vetService');

        vetService
          .getStatus({ currency: 'VET', walletId: 100 })
          .should.be.rejectedWith(ERROR_MSG.SETTLEMENT_NOT_FOUND);
      });
    });

    context('When all arguments is provided', function () {
      it('should work', async function () {
        const vetService = container.resolve('vetService');
        const result = await vetService.addWallet({
          xpubs: ['xpub6DUmnoJCKNtBbC2umgixMNVvxN5P2HdjCASAbbHb1Dt3id1gt1h8ucM9Diw32JVbsy4cUvN4VJQpNxQg4z1niUaj1w1iT5B9n27hWuDvBHY'],
          minimum: 1,
        });

        sinon
          .stub(vetService.api, 'getBalance')
          .returns('123000000000000000000');

        await db('vet_transactions').insert([{
          id: 1,
          type: 'funding',
          walletId: result.id,
          fromAddress: '0xabc',
          toAddress: '0xcva',
          toPath: '0/0/1',
          grossAmount: '12000000000000000000',
          hash: '0xabc',
          clauseIndex: 1,
          currency: 'VET',
          moveFundAtTxHash: null,
        }, {
          id: 2,
          type: 'funding',
          walletId: result.id,
          fromAddress: '0xabc2',
          toAddress: '0xcva3',
          toPath: '0/0/1',
          currency: 'VET',
          grossAmount: '15000000000000000000',
          hash: '0xabc2',
          clauseIndex: 1,
          moveFundAtTxHash: '0xabc3',
        }, {
          id: 3,
          type: 'move_fund',
          state: 'pending',
          walletId: result.id,
          currency: 'VET',
          grossAmount: '15000000000000000000',
          hash: '0xabc3',
          moveFundAtTxHash: null,
          clauseIndex: 1,
        }]);

        const status = await vetService.getStatus({ currency: 'VET', walletId: result.id });

        status.should.deep.equal({
          availableWithdrawal: '123',
          availableBalance: '135',
          totalBalance: '150',
        });
      });
    });
  });
});
