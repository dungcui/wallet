const _ = require('lodash');
const chai = require('chai');
const knex = require('knex');
const sinon = require('sinon');
const awilix = require('awilix');
const spies = require('chai-spies');
const chaiAsPromised = require('chai-as-promised');
const { create: createContainer } = require('../../../src/container');

// TEST DATA
const { expect } = chai;
chai.use(chaiAsPromised);
chai.use(spies);
chai.should();

describe('StellarMonitor', function () {
  let container;
  let db;

  beforeEach(async function () {
    container = createContainer();

    // Set default config, only stub value
    container.register('STELLAR_SLEEP_TIME', awilix.asValue('10'));
    container.register('STELLAR_ITEM_PER_PAGE', awilix.asValue('200'));
    container.register('STELLAR_START_BLOCK_HEIGHT', awilix.asValue('0'));
    container.register('STELLAR_MINIMUM_CONFIRMATION', awilix.asValue('1'));
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

    // Test data
    await db('tokens').insert({
      service: 'STELLAR',
      currency: 'SIX',
      address: 'GDMS6EECOH6MBMCP3FYRYEVRBIV3TQGLOFQIPVAITBRJUMTI6V7A2X6Z',
      enabled: true,
    });

    // Setup wallet
    await db('wallets').insert({
      service: 'STELLAR',
      settlementAddress: 'GA7OPN4A3JNHLPHPEWM4PJDOYYDYNZOM7ES6YL3O7NC3PRY3V3UX6ANM',
    });

    // Another wallet
    await db('wallets').insert({
      service: 'STELLAR',
      settlementAddress: 'GCKQXTQM2HWKZMSUYXINFYF7QMDTLG27E73AZTXRB4HR46NX72L2EV3B',
    });
  });

  afterEach(async function () {
    await db.migrate.rollback();
    await db.destroy();
  });

  // describe('#getBlock', function () {
  //   it('should return block with parsed transactions', async function () {
  //     const stellarMonitor = container.resolve('stellarMonitor');
  //     const block = {
  //       height: 19976215,
  //       hash: '509c7cec61696104ef9982377d6e653fbf830eae01ec1cb0fe4ae1735985ba8c',
  //     };
  //     const transaction1 = {
  //       blockHeight: block.height,
  //       transactionHash: '75c0fc516bca7fb6812bad01b8430552d14ae47820f42df4604603601be426b6',
  //       outputIndex: 0,
  //       from: 'GD6LAV5XDPIYUSQ26TOQGHOFDKK4S2ONSYQTMBAGKXI3Y3URW7FIOYJ6',
  //       fromAddress: null,
  //       to: 'GDHVA6JKFZSHEX755V6N4R732TDI7BNROFWE3GXI2G2VWIFWLIN2XIES',
  //       toAddress: {},
  //       currency: 'XLM',
  //       contractAddress: null,
  //       amount: '100',
  //       feeCurrency: 'XLM',
  //       feeAmount: '0.00001',
  //     };
  //     const transaction2 = {
  //       blockHeight: block.height,
  //       transactionHash: '0ed8e16a0c24a1cbf165b2da3066bd9fe5745db821a2a89a5a3a15ee0535d53b',
  //       outputIndex: 0,
  //       from: 'GDEEGRYEA7NV45ET7TSLHIYBUP4V4I4QONBZRX3AY67CMRJET37JBJP7',
  //       fromAddress: {},
  //       to: 'GDHVA6JKFZSHEX755V6N4R732TDI7BNROFWE3GXI2G2VWIFWLIN2XIES',
  //       toAddress: null,
  //       currency: 'XLM',
  //       contractAddress: null,
  //       amount: '0.4000000',
  //       feeCurrency: 'XLM',
  //       feeAmount: '0.00001',
  //     };
  //     const transactions = [transaction1, transaction2];
  //     sinon
  //       .stub(stellarMonitor.api, 'getBlock')
  //       .onFirstCall()
  //       .resolves({
  //         hash: block.hash,
  //       });
  //     sinon
  //       .stub(stellarMonitor.interpreter, 'parseTransaction')
  //       .onFirstCall()
  //       .resolves([transaction1])
  //       .onSecondCall()
  //       .resolves([transaction2]);
  //     const result = await stellarMonitor.getBlock({
  //       height: block.height,
  //       transactions: _.uniqBy(transactions.map(t => ({ hash: t.transactionHash })), 'hash'),
  //     });
  //     result.should.deep.equal({
  //       hash: block.hash,
  //       transactions,
  //     });
  //   });
  // });

  describe('#getAllAddressTransactions', function () {
    it('should return list of transactions and stopped at start height', async function () {
      container.register('STELLAR_ITEM_PER_PAGE', awilix.asValue('3'));
      const stellarMonitor = container.resolve('stellarMonitor');
      const address = 'GD6LAV5XDPIYUSQ26TOQGHOFDKK4S2ONSYQTMBAGKXI3Y3URW7FIOYJ6';
      const startHeight = 19976215;
      const page1 = {
        records: [{ ledger_attr: 19976300 }, { ledger_attr: 19976299 }, { ledger_attr: 19976298 }],
      };
      const page2 = {
        records: [{ ledger_attr: 19976260 }, { ledger_attr: 19976255 }, { ledger_attr: 19976240 }],
      };
      const page3 = {
        records: [{ ledger_attr: 19976230 }, { ledger_attr: 19976212 }, { ledger_attr: 19976211 }],
      };
      page1.next = sinon.stub().resolves(page2);
      page2.next = sinon.stub().resolves(page3);
      page3.next = sinon.fake.throws(Error('Should not call'));

      sinon
        .stub(stellarMonitor.api, 'findTransactionsByAddress')
        .withArgs(address, 3, 'desc')
        .resolves(page1);

      const result = await stellarMonitor.getAllAddressTransactions(address, startHeight);
      result.should.deep.equal(page1.records.concat(page2.records).concat(page3.records));
    });

    it('should return list of transactions and stopped at end page', async function () {
      container.register('STELLAR_ITEM_PER_PAGE', awilix.asValue('3'));
      const stellarMonitor = container.resolve('stellarMonitor');
      const address = 'GD6LAV5XDPIYUSQ26TOQGHOFDKK4S2ONSYQTMBAGKXI3Y3URW7FIOYJ6';
      const startHeight = 19976210;
      const page1 = {
        records: [{ ledger_attr: 19976300 }, { ledger_attr: 19976299 }, { ledger_attr: 19976298 }],
      };
      const page2 = {
        records: [{ ledger_attr: 19976260 }, { ledger_attr: 19976255 }, { ledger_attr: 19976240 }],
      };
      const page3 = {
        records: [{ ledger_attr: 19976230 }, { ledger_attr: 19976212 }],
      };
      page1.next = sinon.stub().resolves(page2);
      page2.next = sinon.stub().resolves(page3);
      page3.next = sinon.fake.throws(Error('Should not call'));

      sinon
        .stub(stellarMonitor.api, 'findTransactionsByAddress')
        .withArgs(address, 3, 'desc')
        .resolves(page1);

      const result = await stellarMonitor.getAllAddressTransactions(address, startHeight);
      result.should.deep.equal(page1.records.concat(page2.records).concat(page3.records));
    });
  });

  // describe('#fetchNextBlocks', function () {
  //   it('should add next blocks with cached transactions', async function () {
  //     const stellarMonitor = container.resolve('stellarMonitor');
  //     const currentHeight = 19984062;
  //     const confirmedHeight = 19984400;
  //     const addresses = [
  //       'GB5YCA65O5AL2GO4QJS4P4NAVGDWJB7QA4W7BOH7YEFDJTTGRTBB5V6K',
  //       'GC4KAS6W2YCGJGLP633A6F6AKTCV4WSLMTMIQRSEQE5QRRVKSX7THV6S',
  //       'GB6YPGW5JFMMP2QB2USQ33EUWTXVL4ZT5ITUNCY3YKVWOJPP57CANOF3',
  //     ];

  //     sinon
  //       .stub(stellarMonitor.wallets, 'findAllByService')
  //       .resolves(addresses.map(a => ({ settlementAddress: a })));

  //     sinon
  //       .stub(stellarMonitor, 'getAllAddressTransactions')
  //       .withArgs(addresses[0], currentHeight)
  //       .resolves([
  //         { ledger_attr: 19984345, hash: '05916a0880b32d17360e21ae9f3fee5071c575467ba803813600f23540fa8164' },
  //         { ledger_attr: 19984309, hash: 'd9864ee53b9a30c8c7ac7470cde98e33c732499f1a78080bddf29acffb25a269' },
  //         { ledger_attr: 19984269, hash: '2faada617bff576b896ab1f823c5d14878b6882e74098116dbaa33daf4189bfe' },
  //         { ledger_attr: 19984217, hash: '30a907dec223890cbc903cfcfef462d4b31ea9cf07d9c6d5dcd788505b366592' },
  //         { ledger_attr: 19984154, hash: '6903ce25813f856b6b33942ce1f816fa06837950c32ea98e857777b87970de11' },
  //       ])
  //       .withArgs(addresses[1], currentHeight)
  //       .resolves([
  //         { ledger_attr: 19984286, hash: '9962e2a77b00417ca57bcf67ce08aa7e673c2790f02b8b1ac63b14e1d8fde932' },
  //         { ledger_attr: 19984217, hash: '05af2d424dadcdff809b66ab9ec3f146ed5b588955e742c290ab67a6bab36d3d' },
  //         { ledger_attr: 19984062, hash: '5aeb616cd1241196744e2eb9eaa1026aaac179ebfa4bff4f1c530f06038ce545' },
  //         { ledger_attr: 19984027, hash: '474a5e764d4bdbbcc9d2a2012c99bf14878b1d649b79422de3082801555831e6' },
  //         { ledger_attr: 19984026, hash: 'ffafb48816392e1ccca423e14641022256afad09048c5f57f2c3536038ae6acf' },
  //       ])
  //       .withArgs(addresses[2], currentHeight)
  //       .resolves([
  //         { ledger_attr: 19984356, hash: '46ddef0fda3225b6aa6d266a7f6f7d965476d8d19a93b83630e31a36882eac6e' },
  //         { ledger_attr: 19984331, hash: '018ba2bdad8e3534042b2693a06651081ccd20a3678236366b9a54673815e582' },
  //         { ledger_attr: 19984312, hash: 'ae2f1ea1ffa80ffd48699c34f2de173e4a897ba9692281a0e9e84fd4893bb918' },
  //         { ledger_attr: 19984282, hash: '4cb967d10757add209175b85a2d59ce7311bca8a21c9ce9464cf16b286564a76' },
  //         { ledger_attr: 19984257, hash: 'a5a614a07ec1ad727c5116ab0b40a801f202a148a98f2b06c5c77e830b124c4e' },
  //       ]);
  //     await stellarMonitor.fetchNextBlocks(currentHeight, confirmedHeight);

  //     let block = stellarMonitor.nextBlocks.pop();
  //     block.height.should.equal(19984154);
  //     block.transactions.length.should.equal(1);
  //     block.transactions[0].hash.should.equal('6903ce25813f856b6b33942ce1f816fa06837950c32ea98e857777b87970de11');

  //     block = stellarMonitor.nextBlocks.pop();
  //     block.height.should.equal(19984217);
  //     block.transactions.length.should.equal(2);
  //     block.transactions[0].hash.should.equal('30a907dec223890cbc903cfcfef462d4b31ea9cf07d9c6d5dcd788505b366592');
  //     block.transactions[1].hash.should.equal('05af2d424dadcdff809b66ab9ec3f146ed5b588955e742c290ab67a6bab36d3d');

  //     block = stellarMonitor.nextBlocks.pop();
  //     block.height.should.equal(19984257);
  //     block.transactions.length.should.equal(1);
  //     block.transactions[0].hash.should.equal('a5a614a07ec1ad727c5116ab0b40a801f202a148a98f2b06c5c77e830b124c4e');

  //     block = stellarMonitor.nextBlocks.pop();
  //     block.height.should.equal(19984269);
  //     block.transactions.length.should.equal(1);
  //     block.transactions[0].hash.should.equal('2faada617bff576b896ab1f823c5d14878b6882e74098116dbaa33daf4189bfe');

  //     block = stellarMonitor.nextBlocks.pop();
  //     block.height.should.equal(19984282);
  //     block.transactions.length.should.equal(1);
  //     block.transactions[0].hash.should.equal('4cb967d10757add209175b85a2d59ce7311bca8a21c9ce9464cf16b286564a76');

  //     block = stellarMonitor.nextBlocks.pop();
  //     block.height.should.equal(19984286);
  //     block.transactions.length.should.equal(1);
  //     block.transactions[0].hash.should.equal('9962e2a77b00417ca57bcf67ce08aa7e673c2790f02b8b1ac63b14e1d8fde932');

  //     block = stellarMonitor.nextBlocks.pop();
  //     block.height.should.equal(19984309);
  //     block.transactions.length.should.equal(1);
  //     block.transactions[0].hash.should.equal('d9864ee53b9a30c8c7ac7470cde98e33c732499f1a78080bddf29acffb25a269');

  //     block = stellarMonitor.nextBlocks.pop();
  //     block.height.should.equal(19984312);
  //     block.transactions.length.should.equal(1);
  //     block.transactions[0].hash.should.equal('ae2f1ea1ffa80ffd48699c34f2de173e4a897ba9692281a0e9e84fd4893bb918');

  //     block = stellarMonitor.nextBlocks.pop();
  //     block.height.should.equal(19984331);
  //     block.transactions.length.should.equal(1);
  //     block.transactions[0].hash.should.equal('018ba2bdad8e3534042b2693a06651081ccd20a3678236366b9a54673815e582');

  //     block = stellarMonitor.nextBlocks.pop();
  //     block.height.should.equal(19984345);
  //     block.transactions.length.should.equal(1);
  //     block.transactions[0].hash.should.equal('05916a0880b32d17360e21ae9f3fee5071c575467ba803813600f23540fa8164');

  //     block = stellarMonitor.nextBlocks.pop();
  //     block.height.should.equal(19984356);
  //     block.transactions.length.should.equal(1);
  //     block.transactions[0].hash.should.equal('46ddef0fda3225b6aa6d266a7f6f7d965476d8d19a93b83630e31a36882eac6e');

  //     block = stellarMonitor.nextBlocks.pop();
  //     block.height.should.equal(confirmedHeight);
  //     block.transactions.length.should.equal(0);

  //     expect(stellarMonitor.nextBlocks.pop()).to.be.undefined;
  //   });
  // });

  // Integration test
  describe('#start', function () {

  });
});
