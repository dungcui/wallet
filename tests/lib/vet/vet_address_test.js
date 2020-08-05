const chai = require('chai');
const awilix = require('awilix');
const chaiAsPromised = require('chai-as-promised');
const { create: createContainer } = require('../../../src/container');
const knex = require('knex');

let container;
let db;

chai.use(chaiAsPromised);
chai.should();

describe('VetAddress', function () {
  beforeEach(async function () {
    container = createContainer();

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
  });

  afterEach(async function () {
    const { migrate } = db;
    await migrate.rollback();

    await db.destroy();
  });

  describe('#add', function () {
    context('When `hash` is missing', function () {
      it('should throw error', async function () {
        const vetAddress = container.resolve('vetAddress');

        vetAddress
          .add({ path: '0/0/1', type: 'user', walletId: 1 })
          .should.be.rejectedWith('`hash` is missing');
      });
    });
  });
});
