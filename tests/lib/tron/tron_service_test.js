const chai = require('chai');
const awilix = require('awilix');
const knex = require('knex');
const Decimal = require('decimal.js');
const chaiAsPromised = require('chai-as-promised');
const spies = require('chai-spies');

const { create: createContainer } = require('../../../src/container');
const tronBlock207476 = require('./tron_block_207476.json');

chai.use(chaiAsPromised);
chai.use(spies);
chai.should();

describe('TronService', () => {
  let container;
  let db;

  beforeEach(async () => {
    container = createContainer();
    // Set default config, only stub value
    container.register('tronApiUrl', awilix.asValue('https://api.tronscan.org'));
    container.register('tronSleepTime', awilix.asValue(10));
    container.register('tronStartBlockHeight', awilix.asValue(0));
    container.register('tronMinimumMoveFund', awilix.asValue(2000));
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

    // Another wallet
    await db('tron_wallets').insert({
      xpub: 'xpub661MyMwAqRbcFAHX6T2C66buGtyJGUHzDFmV1f3GScTEhZkP6uc7GbFE9rzaDEqKUKTpzELCbYw9B8PQcvSz5an1iBuQVBoaCQiZYPK7b2p',
    });

    // Setup settlement address
    await db('tron_addresses').insert({
      walletId: 1,
      path: '0/1/0',
      hash: 'TUfs2Msh7iQXDCAi81MbdPPGEk6k47SEUi',
      type: 'settlement',
    });
  });

  afterEach(async () => {
    await db.migrate.rollback();
    await db.destroy();
  });

  describe('#addWallet', () => {
    context('when have xpub', () => {
      it('should create wallet', async () => {
        const tronService = container.resolve('tronService');
        // Seed is 456
        const xpubs = ['xpub661MyMwAqRbcFAHX6T2C66buGtyJGUHzDFmV1f3GScTEhZkP6uc7GbFE9rzaDEqKUKTpzELCbYw9B8PQcvSz5an1iBuQVBoaCQiZYPK7b2p'];
        await tronService.addWallet({ xpubs });
        const row = await db('tron_wallets').where('id', 2).first();
        row.xpub.should.equal(xpubs[0]);
      });
    });

    context('when have no xpub', () => {
      it('should throw error', async () => {
        const tronService = container.resolve('tronService');
        await tronService.addWallet().should.be.rejectedWith(Error, tronService.error.MISSING_XPUB_ERROR);
      });
    });

    context('when xpub is not correct', () => {
      it('should throw error', async () => {
        const tronService = container.resolve('tronService');
        const xpubs = ['this is wrong xpub'];
        await tronService.addWallet({ xpubs }).should.be.rejectedWith(Error, tronService.error.INVALID_XPUB);
      });
    });
  });

  describe('#getAddress', () => {
    context('when address not exists', () => {
      it('should return created address', async function t() {
        this.timeout = 10000;
        const tronService = container.resolve('tronService');
        const { hash } = await tronService.getAddress({ walletId: 1, path: '0/1', type: 'user' });
        hash.should.equal('TAk7MwGT7NqT48CA3szVuVVYhkefoto1hf');
      });
    });

    context('when address exists', () => {
      it('should return existed address', async () => {
        // setup db
        await db('tron_addresses').insert({
          walletId: 1, path: '0/2', hash: 'TXHGiDaywGcmwtLFcHqmncHozy4io5j3H3',
        });
        const { count: before } = await db('tron_addresses').count('id as count').first();

        // then get address
        const tronService = container.resolve('tronService');
        const { hash } = await tronService.getAddress({ walletId: 1, path: '0/2', type: 'user' });
        hash.should.equal('TXHGiDaywGcmwtLFcHqmncHozy4io5j3H3');

        // no new address added
        const { count: after } = await db('tron_addresses').count('id as count').first();
        before.should.equal(after);
      });
    });

    context('when not exist wallet id', () => {
      it('should throw error', async () => {
        const tronService = container.resolve('tronService');
        await tronService.getAddress({ walletId: 10, path: '0/1', type: 'user' }).should.be.rejectedWith(Error, tronService.error.WALLET_NOT_FOUND);
        await tronService.getAddress({ path: '0/1', type: 'user' }).should.be.rejectedWith(Error, tronService.error.WALLET_NOT_FOUND);
      });
    });

    context('when empty path', () => {
      it('should throw error', async () => {
        const tronService = container.resolve('tronService');
        await tronService.getAddress({ walletId: 1, path: '', type: 'user' }).should.be.rejectedWith(Error, tronService.error.EMPTY_PATH);
        await tronService.getAddress({ walletId: 1, type: 'user' }).should.be.rejectedWith(Error, tronService.error.EMPTY_PATH);
      });
    });
  });

  describe('#bundleTransactions', () => {
    const walletId = 1;
    context('when type is MOVE_FUND', () => {
      it('should call bundleMoveFund', (done) => {
        const tronService = container.resolve('tronService');
        chai.spy.on(tronService, 'bundleMoveFund', () => done());
        tronService.bundleTransactions({ walletId, type: tronService.transactions.type.MOVE_FUND });
      });
    });

    context('when type is BUNDLE_WITHDRAWAL', () => {
      it('should call bundleWithdrawal', (done) => {
        const tronService = container.resolve('tronService');
        chai.spy.on(tronService, 'bundleWithdrawal', () => done());
        tronService.bundleTransactions({ walletId, type: tronService.transactions.type.WITHDRAWAL });
      });
    });

    context('without type', () => {
      it('should call bundleWithdrawal', (done) => {
        const tronService = container.resolve('tronService');
        chai.spy.on(tronService, 'bundleWithdrawal', () => done());
        tronService.bundleTransactions({ walletId });
      });
    });

    context('without walletId', () => {
      it('should throw error', async () => {
        const tronService = container.resolve('tronService');
        await tronService.bundleTransactions({}).should.be.rejectedWith(Error, tronService.error.WALLET_NOT_FOUND);
      });
    });
  });

  describe('#bundleWithdrawal', () => {
    const transactions = [{
      id: 1, toAddress: 'TAk7MwGT7NqT48CA3szVuVVYhkefoto1hf', grossAmount: 1,
    }];
    const walletId = 1;

    context('when missing transactions', () => {
      it('should throw error', async () => {
        const tronService = container.resolve('tronService');
        await tronService.bundleWithdrawal({ walletId }).should.be.rejectedWith(Error, tronService.error.MISSING_TRANSACTIONS);
        await tronService.bundleWithdrawal({ walletId, transactions: [] }).should.be.rejectedWith(Error, tronService.error.MISSING_TRANSACTIONS);
      });
    });

    context('when wallet not found', () => {
      it('should throw error', async () => {
        const tronService = container.resolve('tronService');
        await tronService.bundleWithdrawal({ walletId: 9, transactions }).should.be.rejectedWith(Error, tronService.error.WALLET_NOT_FOUND);
      });
    });

    context('when not enough balance', () => {
      it('should throw error', async () => {
        const tronApi = {
          getAccount: async () => ({ balance: new Decimal(0) }),
          ONE_TRX: new Decimal(1e6),
        };
        container.register('tronApi', awilix.asValue(tronApi));
        const tronService = container.resolve('tronService');
        await tronService.bundleWithdrawal({ walletId, transactions }).should.be.rejectedWith(Error, tronService.error.INSUFFICIENT_BALANCE);
      });
    });

    context('when having valid inputs', () => {
      it('should bundle transactions', async () => {
        const tronApi = {
          getLatestBlock: () => tronBlock207476,
          getAccount: async () => ({ balance: new Decimal(10000000000) }),
          ONE_TRX: new Decimal(1e6),
        };
        container.register('tronApi', awilix.asValue(tronApi));
        const tronService = container.resolve('tronService');
        const { payload } = await tronService.bundleWithdrawal({ transactions, walletId });
        const result = JSON.parse(payload);
        tronBlock207476.should.contain(result.block_ref);
        const [transaction] = result.transactions;
        transaction.id.should.be.equal(1);
        transaction.from_path.should.be.equal('0/1/0');
        transaction.to_address.should.be.equal(transactions[0].toAddress);
        transaction.gross_amount.should.be.equal(new Decimal(transactions[0].grossAmount).mul(tronService.api.ONE_TRX).toString());
      });
    });
  });

  describe('#bundleMoveFund', () => {
    context('when wallet not found', () => {
      it('should throw error', async () => {
        const tronService = container.resolve('tronService');
        await tronService.bundleMoveFund({ walletId: 9 }).should.be.rejectedWith(Error, tronService.error.WALLET_NOT_FOUND);
      });
    });

    context('when no settlement', () => {
      it('should throw error', async () => {
        const tronService = container.resolve('tronService');
        await tronService.bundleMoveFund({ walletId: 2 }).should.be.rejectedWith(Error, tronService.error.NO_SETTLEMENT);
      });
    });

    context('when no users', () => {
      it('should throw error', async () => {
        await db('tron_addresses').insert({
          walletId: 2,
          path: '0/1/0',
          hash: 'TKFjNjXLd7xC2J6dfEP92sEEU5hwajGM7h',
          type: 'settlement',
        });
        const tronService = container.resolve('tronService');
        await tronService.bundleMoveFund({ walletId: 2 }).should.be.rejectedWith(Error, tronService.error.NO_USER_BALANCE);
      });
    });

    context('when have everything', () => {
      it('should bundle', async () => {
        await db.batchInsert('tron_addresses', [{
          walletId: 1,
          path: '0/0/2',
          hash: 'TK3pzyXaZxTtA2NXWf2xXBEznXXixpB2VG',
          type: 'user',
        }, {
          walletId: 1,
          path: '0/0/3',
          hash: 'TMmmvwvkBPBv3Gkw9cGKbZ8PLznYkTu3ep',
          type: 'user',
        }, {
          walletId: 1,
          path: '0/0/5',
          hash: 'TW2SPuhrmKb2v74CGHx1vayCGKMSMZ6fKH',
          type: 'user',
        }]);

        await db.batchInsert('tron_transactions', [{
          hash: 'testHash1',
          type: 'funding',
          grossAmount: '10000',
          fromAddress: '',
          fromPath: '',
          toAddress: 'TK3pzyXaZxTtA2NXWf2xXBEznXXixpB2VG',
          toPath: '0/0/2',
          blockHeight: 2,
          walletId: 1,
        }, {
          hash: 'testHash2',
          type: 'funding',
          grossAmount: '20000',
          fromAddress: '',
          fromPath: '',
          toAddress: 'TMmmvwvkBPBv3Gkw9cGKbZ8PLznYkTu3ep',
          toPath: '0/0/3',
          blockHeight: 2,
          walletId: 1,
        }, {
          hash: 'testHash3',
          type: 'funding',
          grossAmount: '500',
          fromAddress: '',
          toAddress: 'TW2SPuhrmKb2v74CGHx1vayCGKMSMZ6fKH',
          toPath: '0/0/5',
          moveFundAtTransactionHash: 'moved-already-hash',
          blockHeight: 2,
          walletId: 1,
        }]);

        const tronApi = { getLatestBlock: () => tronBlock207476 };
        container.register('tronApi', awilix.asValue(tronApi));
        const tronService = container.resolve('tronService');
        const { payload } = await tronService.bundleMoveFund({ walletId: 1 });
        const result = JSON.parse(payload);

        // Check block_ref
        tronBlock207476.should.contain(result.block_ref);

        // Check transactions
        const { transactions } = result;
        transactions.length.should.equal(2);

        transactions[0].id.should.equal(-1);
        transactions[0].move_fund_for_id.should.equal(1);
        transactions[0].from_path.should.equal('0/0/2');
        transactions[0].to_path.should.equal('0/1/0');
        transactions[0].gross_amount.should.equal('10000');

        transactions[1].id.should.equal(-1);
        transactions[1].move_fund_for_id.should.equal(2);
        transactions[1].from_path.should.equal('0/0/3');
        transactions[1].to_path.should.equal('0/1/0');
        transactions[1].gross_amount.should.equal('20000');
      });
    });
  });

  describe('#broadcast', () => {
    context('when no payload', () => {
      it('should throw error', () => {
        const tronService = container.resolve('tronService');
        tronService.broadcast({}).should.be.rejectedWith(Error, tronService.error.MISSING_PAYLOAD);
      });
    });

    context('when payload is invalid', () => {
      it('should throw error', () => {
        const tronService = container.resolve('tronService');

        // Missing type
        tronService.broadcast({
          payload: JSON.stringify({
            transactions_hash: { 1: '0A86010A02E0F32208E929241473E0B9A040988AD2E7BC2C5A65080112610A2D747970652E676F6F676C65617069732E636F6D2F70726F746F636F6C2E5472616E73666572436F6E747261637412300A1541087E029D0BCBC1101CB08C0CE5BA21E5014750AF121541CD22A461C58719422F8D901A60BE7A6B3F1D88A918017080BC9DD3A9E2F59A15124139B04AA91041182A36FCE2D0EF91ECBAB7FCD66346A38E7A56D7A1CD5E7DB455D2EFDE0D490465E148153C804DC14130549F76C05FA82C979AE79BE7F2D2C06600' },
          }),
        }).should.be.rejectedWith(Error, tronService.error.INVALID_PAYLOAD);

        // Missing transactions_hash
        tronService.broadcast({
          payload: JSON.stringify({
            type: tronService.transactions.type.WITHDRAWAL,
          }),
        }).should.be.rejectedWith(Error, tronService.error.INVALID_PAYLOAD);
      });
    });

    context('when network say false', () => {
      it('should return empty successTxHash', async () => {
        const txsHash = {
          1: '0A86010A02E0F32208E929241473E0B9A040988AD2E7BC2C5A65080112610A2D747970652E676F6F676C65617069732E636F6D2F70726F746F636F6C2E5472616E73666572436F6E747261637412300A1541087E029D0BCBC1101CB08C0CE5BA21E5014750AF121541CD22A461C58719422F8D901A60BE7A6B3F1D88A918017080BC9DD3A9E2F59A15124139B04AA91041182A36FCE2D0EF91ECBAB7FCD66346A38E7A56D7A1CD5E7DB455D2EFDE0D490465E148153C804DC14130549F76C05FA82C979AE79BE7F2D2C06600',
          2: '0A86010A02E0F32208E929241473E0B9A040988AD2E7BC2C5A65080112610A2D747970652E676F6F676C65617069732E636F6D2F70726F746F636F6C2E5472616E73666572436F6E747261637412300A15412AFF9B55C97BF8C2C98EC94D182246A2F4AD7D6912154151F2A8286ACCA61A8A4D5EB565C77AB2C3A0FEBD18017080A299DEA9E2F59A1512411083B2ED13FFFE155308FCD39515012968B9A89F2F4C0B18391304FEABC888C6A20816ACDF52FEBBD067955651F8D25437B8886DB3EC3968912F4B675A5A8C2901',
        };
        const tronApi = {
          broadcast: async (hex) => {
            hex.should.be.oneOf(Object.values(txsHash));
            return {
              success: false,
              transaction: {
                contracts: [{
                  from: 'TUfs2Msh7iQXDCAi81MbdPPGEk6k47SEUi',
                }],
                hash: String(new Date().getTime() + Math.round(Math.random() * 100)),
              },
            };
          },
        };
        container.register('tronApi', awilix.asValue(tronApi));
        const tronService = container.resolve('tronService');
        const result = await tronService.broadcast({
          payload: JSON.stringify({
            type: tronService.transactions.type.WITHDRAWAL,
            transactions_hash: txsHash,
          }),
        });
        result.payload.should.equal(JSON.stringify({}));
      });
    });

    context('when having valid payload and doing withdrawal', () => {
      it('should broadcast', async () => {
        const txsHash = {
          1: '0A86010A02E0F32208E929241473E0B9A040988AD2E7BC2C5A65080112610A2D747970652E676F6F676C65617069732E636F6D2F70726F746F636F6C2E5472616E73666572436F6E747261637412300A1541087E029D0BCBC1101CB08C0CE5BA21E5014750AF121541CD22A461C58719422F8D901A60BE7A6B3F1D88A918017080BC9DD3A9E2F59A15124139B04AA91041182A36FCE2D0EF91ECBAB7FCD66346A38E7A56D7A1CD5E7DB455D2EFDE0D490465E148153C804DC14130549F76C05FA82C979AE79BE7F2D2C06600',
          2: '0A86010A02E0F32208E929241473E0B9A040988AD2E7BC2C5A65080112610A2D747970652E676F6F676C65617069732E636F6D2F70726F746F636F6C2E5472616E73666572436F6E747261637412300A15412AFF9B55C97BF8C2C98EC94D182246A2F4AD7D6912154151F2A8286ACCA61A8A4D5EB565C77AB2C3A0FEBD18017080A299DEA9E2F59A1512411083B2ED13FFFE155308FCD39515012968B9A89F2F4C0B18391304FEABC888C6A20816ACDF52FEBBD067955651F8D25437B8886DB3EC3968912F4B675A5A8C2901',
        };
        const tronApi = {
          broadcast: async (hex) => {
            hex.should.be.oneOf(Object.values(txsHash));
            return {
              success: true,
              transaction: {
                contracts: [{
                  from: 'TUfs2Msh7iQXDCAi81MbdPPGEk6k47SEUi',
                }],
                hash: String(new Date().getTime() + Math.round(Math.random() * 100)),
              },
            };
          },
        };
        container.register('tronApi', awilix.asValue(tronApi));
        const tronService = container.resolve('tronService');
        await tronService.broadcast({
          payload: JSON.stringify({
            type: tronService.transactions.type.WITHDRAWAL,
            transactions_hash: txsHash,
          }),
        });
      });
    });

    context('when having valid payload and doing move fund', () => {
      it('should broadcast', async () => {
        await db.batchInsert('tron_transactions', [{
          hash: 'fundingHash1',
          state: 'confirmed',
          type: 'funding',
          grossAmount: 1,
          fromAddress: '',
          fromPath: '',
          toAddress: 'TUfs2Msh7iQXDCAi81MbdPPGEk6k47SEUi',
          moveFundAtTransactionHash: 'moveFundHash1',
          toPath: '0/1/0',
          blockHeight: 1,
          walletId: 1,
        }, {
          hash: 'fundingHash2',
          state: 'confirmed',
          type: 'funding',
          grossAmount: 1,
          fromAddress: '',
          fromPath: '',
          toAddress: 'TUfs2Msh7iQXDCAi81MbdPPGEk6k47SEUi',
          moveFundAtTransactionHash: 'moveFundHash2',
          toPath: '0/1/0',
          blockHeight: 1,
          walletId: 1,
        }]);

        const txsHash = {
          1: '0A86010A02E0F32208E929241473E0B9A040988AD2E7BC2C5A65080112610A2D747970652E676F6F676C65617069732E636F6D2F70726F746F636F6C2E5472616E73666572436F6E747261637412300A1541087E029D0BCBC1101CB08C0CE5BA21E5014750AF121541CD22A461C58719422F8D901A60BE7A6B3F1D88A918017080BC9DD3A9E2F59A15124139B04AA91041182A36FCE2D0EF91ECBAB7FCD66346A38E7A56D7A1CD5E7DB455D2EFDE0D490465E148153C804DC14130549F76C05FA82C979AE79BE7F2D2C06600',
          2: '0A86010A02E0F32208E929241473E0B9A040988AD2E7BC2C5A65080112610A2D747970652E676F6F676C65617069732E636F6D2F70726F746F636F6C2E5472616E73666572436F6E747261637412300A15412AFF9B55C97BF8C2C98EC94D182246A2F4AD7D6912154151F2A8286ACCA61A8A4D5EB565C77AB2C3A0FEBD18017080A299DEA9E2F59A1512411083B2ED13FFFE155308FCD39515012968B9A89F2F4C0B18391304FEABC888C6A20816ACDF52FEBBD067955651F8D25437B8886DB3EC3968912F4B675A5A8C2901',
        };

        const txsMoveFundHash = {
          '0A86010A02E0F32208E929241473E0B9A040988AD2E7BC2C5A65080112610A2D747970652E676F6F676C65617069732E636F6D2F70726F746F636F6C2E5472616E73666572436F6E747261637412300A1541087E029D0BCBC1101CB08C0CE5BA21E5014750AF121541CD22A461C58719422F8D901A60BE7A6B3F1D88A918017080BC9DD3A9E2F59A15124139B04AA91041182A36FCE2D0EF91ECBAB7FCD66346A38E7A56D7A1CD5E7DB455D2EFDE0D490465E148153C804DC14130549F76C05FA82C979AE79BE7F2D2C06600': 'moveFundHash1',
          '0A86010A02E0F32208E929241473E0B9A040988AD2E7BC2C5A65080112610A2D747970652E676F6F676C65617069732E636F6D2F70726F746F636F6C2E5472616E73666572436F6E747261637412300A15412AFF9B55C97BF8C2C98EC94D182246A2F4AD7D6912154151F2A8286ACCA61A8A4D5EB565C77AB2C3A0FEBD18017080A299DEA9E2F59A1512411083B2ED13FFFE155308FCD39515012968B9A89F2F4C0B18391304FEABC888C6A20816ACDF52FEBBD067955651F8D25437B8886DB3EC3968912F4B675A5A8C2901': 'moveFundHash2',
        };

        const tronApi = {
          broadcast: (hex) => {
            hex.should.be.oneOf(Object.values(txsHash));
            return {
              success: true,
              transaction: {
                contracts: [{
                  from: 'TUfs2Msh7iQXDCAi81MbdPPGEk6k47SEUi',
                }],
                hash: txsMoveFundHash[hex],
              },
            };
          },
        };
        container.register('tronApi', awilix.asValue(tronApi));

        const tronTransaction = container.resolve('tronTransaction');
        container.register('tronTransaction', awilix.asValue(tronTransaction));

        const tronService = container.resolve('tronService');
        await tronService.broadcast({
          payload: JSON.stringify({
            type: tronService.transactions.type.MOVE_FUND,
            transactions_hash: txsHash,
          }),
        });
      });
    });
  });

  describe('#validateAddress', () => {
    context('when address is valid', () => {
      it('should return true', async () => {
        const tronApi = {
          validateAddress: async () => true,
        };
        container.register('tronApi', awilix.asValue(tronApi));
        const tronService = container.resolve('tronService');
        const { valid } = await tronService.validateAddress({ hash: '123' });
        valid.should.equal(true);
      });
    });

    context('when address is invalid', () => {
      it('should return false', async () => {
        const tronApi = {
          validateAddress: async () => false,
        };
        container.register('tronApi', awilix.asValue(tronApi));
        const tronService = container.resolve('tronService');
        const { valid } = await tronService.validateAddress({ hash: '123' });
        valid.should.equal(false);
      });
    });
  });

  describe('#getStatus', function () {
    context('when missing wallet', async function () {
      it('should throw', function () {
        const tronService = container.resolve('tronService');
        tronService.getStatus({}).should.be.rejectedWith(Error, tronService.error.WALLET_NOT_FOUND);
        tronService.getStatus({ walletId: 100 }).should.be.rejectedWith(Error, tronService.error.WALLET_NOT_FOUND);
      });
    });

    context('when wallet is valid', function () {
      it('should get correct balance', async function () {
        this.timeout = 10000;
        const tronApi = {
          ONE_TRX: new Decimal(1e6),
          getAccount: async () => ({ balance: new Decimal(0) }),
        };
        container.register('tronApi', awilix.asValue(tronApi));
        const tronService = container.resolve('tronService');
        const status = await tronService.getStatus({ walletId: 1 });
        status.availableWithdrawal.should.equal('0');
        status.availableBalance.should.equal('0');
        status.totalBalance.should.equal('0');
      });

      it('should get correct balance', async function () {
        this.timeout = 10000;

        await db.batchInsert('tron_transactions', [{
          hash: 'fundingHash1',
          state: 'confirmed',
          type: 'funding',
          grossAmount: 1e6,
          fromAddress: '',
          fromPath: '',
          toAddress: 'TUfs2Msh7iQXDCAi81MbdPPGEk6k47SEUi',
          toPath: '0/1/0',
          blockHeight: 1,
          walletId: 1,
        }, {
          hash: 'fundingHash2',
          state: 'confirmed',
          type: 'funding',
          grossAmount: 2e6,
          fromAddress: '',
          fromPath: '',
          toAddress: 'TUfs2Msh7iQXDCAi81MbdPPGEk6k47SEUi',
          toPath: '0/1/0',
          blockHeight: 1,
          walletId: 1,
        }, {
          hash: 'fundingHash3',
          state: 'confirmed',
          type: 'funding',
          grossAmount: 2e6,
          fromAddress: '',
          fromPath: '',
          toAddress: 'TUfs2Msh7iQXDCAi81MbdPPGEk6k47SEUi',
          toPath: '0/1/0',
          moveFundAtTransactionHash: 'moveFundHash1',
          blockHeight: 1,
          walletId: 1,
        }, {
          hash: 'moveFundHash1',
          state: 'pending',
          type: 'move_fund',
          fromAddress: '',
          fromPath: '',
          toAddress: 'TUfs2Msh7iQXDCAi81MbdPPGEk6k47SEUi',
          toPath: '0/1/0',
          blockHeight: 1,
          walletId: 1,
        }]);
        const tronApi = {
          ONE_TRX: new Decimal(1e6),
          getAccount: async () => ({ balance: new Decimal(1000000) }),
        };
        container.register('tronApi', awilix.asValue(tronApi));
        const tronService = container.resolve('tronService');
        const status = await tronService.getStatus({ walletId: 1 });
        status.availableWithdrawal.should.equal('1');
        status.availableBalance.should.equal('4');
        status.totalBalance.should.equal('6');
      });
    });
  });
});
