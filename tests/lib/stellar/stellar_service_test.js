const chai = require('chai');
const knex = require('knex');
const awilix = require('awilix');
const chaiAsPromised = require('chai-as-promised');
const { create: createContainer } = require('../../../src/container');

const stellarAccount = require('./stellar_account.json');

chai.use(chaiAsPromised);
chai.should();

describe('StellarService', function () {
  let container;
  let db;

  beforeEach(async function () {
    container = createContainer();

    // Set default config, only stub value
    container.register('STELLAR_ITEM_PER_PAGE', awilix.asValue(200));
    container.register('STELLAR_API_URL', awilix.asValue('https://horizon.stellar.org'));

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

    // Initialize test data
    await db('tokens').insert({
      enabled: true,
      currency: 'SIX',
      service: 'STELLAR',
      address: 'GDMS6EECOH6MBMCP3FYRYEVRBIV3TQGLOFQIPVAITBRJUMTI6V7A2X6Z',
    });

    await db('wallets').insert({
      service: 'STELLAR',
      settlementAddress: 'GA7OPN4A3JNHLPHPEWM4PJDOYYDYNZOM7ES6YL3O7NC3PRY3V3UX6ANM',
    });

    await db('addresses').insert({
      memo: null,
      walletId: 1,
      path: '0/1/0',
      type: 'settlement',
      service: 'STELLAR',
      address: 'settlement',
    });
  });

  afterEach(async function () {
    await db.migrate.rollback();
    await db.destroy();
  });

  describe('#validateAddress', function () {
    const hash = 'GA7OPN4A3JNHLPHPEWM4PJDOYYDYNZOM7ES6YL3O7NC3PRY3V3UX6ANM';
    const currency = 'XLM';
    const fakeCurrency = 'FAKE';

    context('when missing address', function () {
      it('should throw error', async function () {
        const stellarService = container.resolve('stellarService');
        await stellarService.validateAddress({
          currency,
        }).should.be.rejectedWith(Error, stellarService.error.MISSING_ADDRESS);
      });
    });

    context('when cannot get account from api (invalid account)', function () {
      it('should return false', async function () {
        const stellarService = container.resolve('stellarService');
        stellarService.api.getAccount = async () => {
          throw new Error();
        };
        const { valid } = await stellarService.validateAddress({
          hash,
          currency,
        });
        valid.should.be.false;
      });
    });

    context('when the account does not trust the currency', function () {
      it('should return false', async function () {
        const stellarService = container.resolve('stellarService');
        stellarService.api.getAccount = async () => stellarAccount;
        const { valid } = await stellarService.validateAddress({
          hash,
          currency: fakeCurrency,
        });
        valid.should.be.false;
      });
    });

    context('when the account exist and trust the currency', function () {
      it('should return true', async function () {
        const stellarService = container.resolve('stellarService');
        stellarService.api.getAccount = async () => stellarAccount;
        const { valid } = await stellarService.validateAddress({
          hash,
          currency,
        });
        valid.should.be.true;
      });
    });
  });

  describe('#validateWallet', function () {
    const settlementAddress = 'GA7OPN4A3JNHLPHPEWM4PJDOYYDYNZOM7ES6YL3O7NC3PRY3V3UX6ANM';

    context('when missing settlement address', function () {
      it('should throw error', async function () {
        const stellarService = container.resolve('stellarService');
        await stellarService.validateWallet({
        }).should.be.rejectedWith(Error, stellarService.error.MISSING_SETTLEMENT_ADDRESS);
      });
    });

    context('when settlement address already exist in database', function () {
      it('should throw error', async function () {
        const stellarService = container.resolve('stellarService');
        await stellarService.validateWallet({
          settlementAddress,
        }).should.be.rejectedWith(Error, stellarService.error.ALREADY_HAS_WALLET);
      });
    });

    context('when cannot get account from api (invalid account)', function () {
      it('should throw error', async function () {
        const stellarService = container.resolve('stellarService');
        stellarService.wallets.findBySettlementAddress = async () => false;
        stellarService.api.getAccount = async () => {
          throw new Error();
        };
        await stellarService.validateWallet({
          settlementAddress,
        }).should.be.rejectedWith(Error, stellarService.error.INVALID_SETTLEMENT_ADDRESS);
      });
    });

    context('when successfully validate wallet', function () {
      it('should return the account', async function () {
        const stellarService = container.resolve('stellarService');
        stellarService.wallets.findBySettlementAddress = async () => false;
        stellarService.api.getAccount = async () => stellarAccount;
        const account = await stellarService.validateWallet({
          settlementAddress,
        });
        // Check 2 objects equal with each other
        JSON.stringify(account).should.be.equal(JSON.stringify(stellarAccount));
      });
    });
  });
});
