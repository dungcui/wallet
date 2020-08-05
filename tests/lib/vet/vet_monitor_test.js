const chai = require('chai');
const awilix = require('awilix');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const { create: createContainer } = require('../../../src/container');
const knex = require('knex');
const fs = require('fs');
const { join } = require('path');

let container;
let db;

chai.use(chaiAsPromised);
chai.should();

const dummyApiUrl = 'http://dummyapiurl.com';
const dummyStartingHeight = 10;
const sleepTime = 0.05; // 50ms;

describe('VetMonitor', function () {
  beforeEach(async function () {
    container = createContainer();

    container.register('vetApiUrl', awilix.asValue(dummyApiUrl));
    container.register('vetApiSleepTime', awilix.asValue(10));
    container.register('vetStartBlockHeight', awilix.asValue(dummyStartingHeight));
    container.register('vetSleepTime', awilix.asValue(sleepTime));
    container.register('vetMinimumConfirmation', awilix.asValue(10));
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
      xpub: '0xabc',
    });
  });

  afterEach(async function () {
    const { migrate } = db;
    await migrate.rollback();

    await db.destroy();
  });

  describe('#run()', function () {
    context('When monitor is not running', function () {
      it('Should stop monitoring network', async function () {
        const vetMonitor = container.resolve('vetMonitor');

        sinon.spy(vetMonitor.blocks, 'getLatest');

        vetMonitor.isRunning = false;
        await vetMonitor.run();

        vetMonitor.blocks.getLatest.called.should.be.false;
      });
    });

    context('When there are blocks record in the system', function () {
      it('Should monitor from system recorded block', async function () {
        const dummyHeight = 100;

        await db('vet_blocks').insert({
          hash: '0x0',
          height: dummyHeight,
        });

        const vetMonitor = container.resolve('vetMonitor');

        sinon
          .stub(vetMonitor.api, 'getLatestBlockHeight')
          .returns(1000);

        sinon
          .stub(vetMonitor, 'processBlock')
          .returns(0);

        setTimeout(function () {
          vetMonitor.isRunning = false;
        }, 10);

        vetMonitor.isRunning = true;
        await vetMonitor.run();
        vetMonitor.processBlock.calledWith({ height: dummyHeight + 1 }).should.be.true;

        await db('vet_blocks').del();
      });
    });

    context('When there is no block in the system', function () {
      it('Should monitor from config starting block', async function () {
        const vetMonitor = container.resolve('vetMonitor');

        sinon
          .stub(vetMonitor.api, 'getLatestBlockHeight')
          .returns(1000);

        sinon
          .stub(vetMonitor, 'processBlock')
          .returns(0);

        setTimeout(function () {
          vetMonitor.isRunning = false;
        }, 10);

        vetMonitor.isRunning = true;

        await vetMonitor.run();
        vetMonitor.processBlock.calledWith({ height: dummyStartingHeight }).should.be.true;
      });
    });

    context('When new block height is not confirmed', function () {
      it('Should wait for short time before checking again', async function () {
        const vetMonitor = container.resolve('vetMonitor');
        this.timeout(100);

        sinon
          .stub(vetMonitor.api, 'getLatestBlockHeight')
          .returns(dummyStartingHeight);

        sinon.spy(vetMonitor, 'run');
        sinon.spy(vetMonitor, 'processBlock');

        setTimeout(function () {
          vetMonitor.isRunning = false;
        }, sleepTime + 0.01);

        vetMonitor.isRunning = true;

        await vetMonitor.run();
        vetMonitor.run.calledTwice.should.be.true;
        vetMonitor.processBlock.called.should.be.false;
      });
    });

    context('When new block height is confirmed', function () {
      it('Should process that block', async function () {
        const vetMonitor = container.resolve('vetMonitor');

        sinon
          .stub(vetMonitor.api, 'getLatestBlockHeight')
          .returns(1000);

        sinon
          .stub(vetMonitor, 'processBlock')
          .returns(0);

        setTimeout(function () {
          vetMonitor.isRunning = false;
        }, 10);

        vetMonitor.isRunning = true;

        await vetMonitor.run();
        vetMonitor.processBlock.called.should.be.true;
      });
    });
  });

  describe('#buildBalancesHash(transactions)', function () {
    context('When `transactions` is empty or undefined', function () {
      it('Should return empty balanceHash', async function () {
        const vetMonitor = container.resolve('vetMonitor');

        const result1 = await vetMonitor.buildBalancesHash([]);
        const result2 = await vetMonitor.buildBalancesHash();

        result1.should.deep.equal({ VET: {} });
        result2.should.deep.equal({ VET: {} });
      });
    });

    context('When `transactions` is provided', function () {
      it('Should return balanceHash', async function () {
        const vetMonitor = container.resolve('vetMonitor');
        const inputPath = fs.readFileSync(join(__dirname, '/balances_hash_input.json'));
        const outputPath = fs.readFileSync(join(__dirname, '/balances_hash_output.json'));

        const fundingTxs = JSON.parse(inputPath);
        const expectedBalancesHash = JSON.parse(outputPath);

        const result = await vetMonitor.buildBalancesHash(fundingTxs);

        result.should.deep.equal(expectedBalancesHash);
      });
    });
  });

  describe('#formatTxs(txs)', function () {
    context('When `txs` is empty or undefined', function () {
      it('should return empty array', function () {
        const vetMonitor = container.resolve('vetMonitor');
        const result = vetMonitor.formatTxs();
        result.should.deep.equal([]);
      });
    });

    context('When transaction clause is a VET transfer', function () {
      it('should append `toAddress` from `clause.to`', function () {
        const txs = [{
          id: '0x6d6c9fe6b557c99975dcc3119d5c04f59ebe60e8dc59f744e8aa37cbd6eb97df',
          chainTag: 74,
          blockRef: '0x000488f367e7c254',
          expiration: 720,
          clauses: [
            {
              to: '0x9a514471efb92121bf2f597e4c234ad851b227f0',
              value: '0x8adb167cdbfd3890000',
              data: '0x',
            },
          ],
          gasPriceCoef: 0,
          gas: 21000,
          origin: '0xa4adafaef9ec07bc4dc6de146934c7119341ee25',
          nonce: '0xb790ffc7e56a7d33',
          dependsOn: null,
          size: 131,
          meta: {
            blockID: '0x000488f458f372029e762eddaa60f7a3cecdbe080ffcec8a09d2bf3ce3498a5a',
            blockNumber: 297204,
            blockTimestamp: 1533289450,
          },
        }];

        const vetMonitor = container.resolve('vetMonitor');
        const result = vetMonitor.formatTxs(txs);

        txs[0].clauses[0].toAddress = '0x9a514471efb92121bf2f597e4c234ad851b227f0';

        result.should.deep.equal(txs);
      });
    });

    context('When transaction clause is a VTHO transfer', function () {
      it('should append `toAddress` extracted from `data`', function () {
        const txs = [{
          id: '0x6d100cc4f181579822d40d2c6a01408e0e66c94612f9afd18a7a2fbd7bb9cc3a',
          chainTag: 74,
          blockRef: '0x0004660f2ed005e1',
          expiration: 720,
          clauses: [
            {
              to: '0x0000000000000000000000000000456e65726779',
              value: '0x0',
              data: '0xa9059cbb000000000000000000000000a79564e3dff151cdc51adf0b4e2507a79deaba2100000000000000000000000000000000000000000000002086ac351052600000',
            },
          ],
          gasPriceCoef: 0,
          gas: 60000,
          origin: '0x13e8e179aae8811fd976fe37ad96a73012536a4e',
          nonce: '0x767c812a6386c3b8',
          dependsOn: null,
          size: 192,
          meta: {
            blockID: '0x0004661114348b709053676a05e109ec02a748b359867149e5620e2bf89e2a4c',
            blockNumber: 288273,
            blockTimestamp: 1533200130,
          },
        }];

        const vetMonitor = container.resolve('vetMonitor');
        const result = vetMonitor.formatTxs(txs);

        txs[0].clauses[0].toAddress = '0xa79564e3dff151cdc51adf0b4e2507a79deaba21';
        result.should.deep.equal(txs);
      });
    });

    context('When transaction clause is neither VET or VTHO transfer', function () {
      it('should not append `toAddress` to clause', function () {
        const txs = [{
          id: '0x6d100cc4f181579822d40d2c6a01408e0e66c94612f9afd18a7a2fbd7bb9cc3a',
          chainTag: 74,
          blockRef: '0x0004660f2ed005e1',
          expiration: 720,
          clauses: [
            {
              to: '0x0000000000000000000000000000123e65726778',
              value: '0x0',
              data: '0xa9059cbb000000000000000000000000a79564e3dff151cdc51adf0b4e2507a79deaba2100000000000000000000000000000000000000000000002086ac351052600000',
            },
          ],
          gasPriceCoef: 0,
          gas: 60000,
          origin: '0x13e8e179aae8811fd976fe37ad96a73012536a4e',
          nonce: '0x767c812a6386c3b8',
          dependsOn: null,
          size: 192,
          meta: {
            blockID: '0x0004661114348b709053676a05e109ec02a748b359867149e5620e2bf89e2a4c',
            blockNumber: 288273,
            blockTimestamp: 1533200130,
          },
        }];

        const vetMonitor = container.resolve('vetMonitor');
        const result = vetMonitor.formatTxs(txs);

        result.should.deep.equal(txs);
      });
    });
  });

  describe('#processBlock({ height })', function () {
    context('When block is not found', function () {
      it('Should end process', async function () {
        const vetMonitor = container.resolve('vetMonitor');

        sinon
          .stub(vetMonitor.api, 'getBlock')
          .returns(undefined);

        sinon.spy(vetMonitor.api, 'getTransaction');

        await vetMonitor.processBlock({ height: 10000 });

        vetMonitor.api.getTransaction.called.should.be.false;
      });
    });

    context('When transaction data is not found', function () {
      it('Should throw error', async function () {
        const vetMonitor = container.resolve('vetMonitor');

        sinon
          .stub(vetMonitor.api, 'getBlock')
          .returns({ transactions: ['dummyHash1', 'dummyHash2'] });

        sinon
          .stub(vetMonitor.api, 'getTransaction')
          .returns(undefined);

        vetMonitor
          .processBlock({ height: 10000 })
          .should.be.rejectedWith('Can not find data of transaction dummyHash1');

        vetMonitor.api.getTransaction.restore();
        sinon
          .stub(vetMonitor.api, 'getTransaction')
          .returns({});

        vetMonitor
          .processBlock({ height: 10000 })
          .should.be.rejectedWith('Can not find data of transaction dummyHash1');
      });
    });

    context('When block height is valid', function () {
      it('Should work', async function () {
        const vetMonitor = container.resolve('vetMonitor');
        const path = join(__dirname, './get_transactions_data.json');
        const input = JSON.parse(fs.readFileSync(path));

        sinon
          .stub(vetMonitor.api, 'getBlock')
          .returns({
            transactions: [
              '0x6d6c9fe6b557c99975dcc3119d5c04f59ebe60e8dc59f744e8aa37cbd6eb97df',
              '0x37f667d186ef2ab24722a7770eb0b42d773d1b0e78e6043bcde416266de4bef7',
              '0x55df228ebb9f43f65ff0a020a7ecc16f02bd68b62790c271e0132e2584a43e10',
              '0x6d6c9fe6b557c99975dcc3119d5c04f59ebe60e8dc59f754e8aa37cbd6eb97df',
            ],
            id: '0x00046e682a0007d248b48d38d9e02554be2867ec0514ef9040d9b17143efc4f0',
          });

        sinon
          .stub(vetMonitor.api, 'getTransaction')
          .callsFake(hash => input[hash]);

        await db('vet_addresses').insert([{
          hash: '0x9a514471efb92121bf2f597e4c234ad851b227f0',
          path: '0/0/1',
          walletId: 1,
          type: 'user',
        }, {
          hash: '0x9a514471efb92121bf2f597e4c234ad851b227f1',
          path: '0/1/0',
          walletId: 1,
          type: 'settlement',
        }]);

        await db('vet_transactions').insert([{
          state: 'pending',
          type: 'move_fund',
          hash: '0x37f667d186ef2ab24722a7770eb0b42d773d1b0e78e6043bcde416266de4bef7',
          clauseIndex: 1,
          toAddress: '0x9a514471efb92121bf2f597e4c234ad851b227f0',
          walletId: 1,
          grossAmount: '10000',
          currency: 'VET',
        }, {
          state: 'pending',
          toAddress: '0x56f887120c49f6517141673200d97393bb29e596',
          type: 'withdrawal',
          hash: '0x55df228ebb9f43f65ff0a020a7ecc16f02bd68b62790c271e0132e2584a43e10',
          currency: 'VET',
          clauseIndex: 1,
          grossAmount: '10000',
          walletId: 1,
        }, {
          state: 'pending',
          toAddress: '0x319047bd53240c470c4f27566ca06be1ac763354',
          type: 'withdrawal',
          hash: '0x55df228ebb9f43f65ff0a020a7ecc16f02bd68b62790c271e0132e2584a43e10',
          currency: 'VET',
          grossAmount: '10000',
          clauseIndex: 2,
          walletId: 1,
        }, {
          state: 'pending',
          toAddress: '0xed56032fc1cb66030e38db03196950997dd1ddbe',
          type: 'withdrawal',
          hash: '0x55df228ebb9f43f65ff0a020a7ecc16f02bd68b62790c271e0132e2584a43e10',
          currency: 'VET',
          clauseIndex: 3,
          grossAmount: '10000',
          walletId: 1,
        }]);

        await vetMonitor.processBlock({ height: 10000 });
      });
    });
  });
});
