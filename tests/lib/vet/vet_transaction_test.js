const chai = require('chai');
const awilix = require('awilix');
const chaiAsPromised = require('chai-as-promised');
const { create: createContainer } = require('../../../src/container');
const knex = require('knex');

let container;
let db;

chai.use(chaiAsPromised);
chai.should();

describe('VetTransaction', function () {
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

    await db('vet_wallets').insert({
      xpub: '0xabc',
    });
  });

  afterEach(async function () {
    const { migrate } = db;
    await migrate.rollback();

    await db.destroy();
  });

  describe('#checkTransferType()', function () {
    context('When `clause` or `clause.data` is missing', function () {
      it('Should return empty object', async function () {
        const vetTransaction = container.resolve('vetTransaction');

        const result1 = vetTransaction.checkTransferType();
        const result2 = vetTransaction.checkTransferType({});

        result1.should.deep.equal({});
        result2.should.deep.equal({});
      });
    });

    context('When `clause.data` is "0x"', function () {
      it('Should return VET currency and amount', async function () {
        const vetTransaction = container.resolve('vetTransaction');
        const clause = {
          data: '0x',
          value: '0x160c727f7aba61e10000',
          to: '0xccd1f2cb3755791736e90c97c91b8e592ddb96cf',
        };

        const result = vetTransaction.checkTransferType(clause);

        result.should.deep.equal({
          currency: 'VET',
          grossAmount: '104121674000000000000000',
        });
      });
    });

    context('When `clause.data` is type VTHO transfer', function () {
      it('Should return VTHO currency and amount', async function () {
        const vetTransaction = container.resolve('vetTransaction');
        const clause = {
          data: '0xa9059cbb000000000000000000000000a4adafaef9ec07bc4dc6de146934c7119341ee25000000000000000000000000000000000000000000000002fa23ee082ee70000',
          value: '0x0',
          to: '0x0000000000000000000000000000456e65726779',
        };

        const result = vetTransaction.checkTransferType(clause);

        result.should.deep.equal({
          currency: 'VTHO',
          grossAmount: '54918000000000000000',
        });

        const clause2 = {
          data: 'a9059cbb000000000000000000000000a4adafaef9ec07bc4dc6de146934c7119341ee25000000000000000000000000000000000000000000000002fa23ee082ee70000',
          value: '0x0',
          to: '0x0000000000000000000000000000456e65726779',
        };

        const result2 = vetTransaction.checkTransferType(clause2);

        result2.should.deep.equal({
          currency: 'VTHO',
          grossAmount: '54918000000000000000',
        });
      });
    });

    context('When `clause.data` is valid but can not recognize', function () {
      it('Should return empty object', async function () {
        const vetTransaction = container.resolve('vetTransaction');
        const clause = {
          data: '0xa9059cbb000000000000000000000000a4adafaef9ec07bc4dc6de146934c7119341ee250000000000000000000000000000000000000000002fa23ee082ee70000',
          value: '0x2710',
        };

        const clause2 = {
          data: '0xa9069cbb000000000000000000000000a4adafaef9ec07bc4dc6de146934c7119341ee250000000000000000000000000000000000000000002fa23ee082ee70000',
          value: '0x2710',
        };

        const result = vetTransaction.checkTransferType(clause);
        const result2 = vetTransaction.checkTransferType(clause2);

        result.should.deep.equal({});
        result2.should.deep.equal({});
      });
    });
  });

  describe('#addMany', function () {
    context('When hash type property is not lowercase', function () {
      it('should lowercase them', async function () {
        const vetTransaction = container.resolve('vetTransaction');

        await vetTransaction.addMany([{
          hash: '0x086e3ED889690f2541787210ea07b66cbd7b8bfde44ddc7ed8be753d64318bda',
          clauseIndex: 1,
          walletId: 1,
          grossAmount: '10000000',
          currency: 'VET',
        }, {
          hash: '0x917c583BB81d9829985f1f5f904b07b2e5b5acadc518292499819850de5c2cb3',
          clauseIndex: 1,
          toAddress: '0x77884d83cfd27dDA54a9bfc4fe2740215ff312b8',
          walletId: 1,
          grossAmount: '10000000',
          currency: 'VET',
        }, {
          hash: '0x917c583BB81d9829985f1f5f904b07b2e5b5acadc518292499819850de5c2cb3',
          clauseIndex: 2,
          toAddress: '0x524f62D5bA045E8BcF99f79b601D56fC39E4BFcE',
          fromAddress: '0xa4aDAfAef9Ec07BC4Dc6De146934C7119341eE25',
          walletId: 1,
          grossAmount: '10000000',
          currency: 'VET',
        }]);

        const result = await db('vet_transactions').select('hash', 'toAddress', 'fromAddress', 'clauseIndex', 'grossAmount', 'currency').where({});

        result.should.deep.equal([{
          hash: '0x086e3ed889690f2541787210ea07b66cbd7b8bfde44ddc7ed8be753d64318bda',
          clauseIndex: 1,
          toAddress: null,
          fromAddress: null,
          grossAmount: 10000000,
          currency: 'VET',
        }, {
          hash: '0x917c583bb81d9829985f1f5f904b07b2e5b5acadc518292499819850de5c2cb3',
          toAddress: '0x77884d83cfd27dda54a9bfc4fe2740215ff312b8',
          clauseIndex: 1,
          fromAddress: null,
          grossAmount: 10000000,
          currency: 'VET',
        }, {
          hash: '0x917c583bb81d9829985f1f5f904b07b2e5b5acadc518292499819850de5c2cb3',
          toAddress: '0x524f62d5ba045e8bcf99f79b601d56fc39e4bfce',
          clauseIndex: 2,
          fromAddress: '0xa4adafaef9ec07bc4dc6de146934c7119341ee25',
          grossAmount: 10000000,
          currency: 'VET',
        }]);

        await vetTransaction.addMany([{
          toAddress: '0xasdlkjasldasdadad',
        }]).should.be.rejected;
      });
    });
  });

  describe('#addSettlementFunding', function () {
    context('When `confirmedTxsHash` is provided', function () {
      it('should add only non-confirm funding settlement transaction', async function () {
        const transactions1 = [{
          id: '0x6d6c9fe6b557c99975dcc3119d5c04f59ebe60e8dc59f744e8aa37cbd6eb97df',
          chainTag: 74,
          blockRef: '0x000488f367e7c254',
          expiration: 720,
          clauses: [
            {
              to: '0x9a514471efb92121bf2f597e4c234ad851b227f0',
              value: '0x8adb167cdbfd3890000',
              data: '0x',
              address: {
                type: 'settlement',
                path: '0/1/0',
                id: 2,
                walletId: 1,
              },
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
        }, {
          id: '0x3e022fde3de3bc3fc475084972442a4f7f96ff992af4dd9179e109dc89fbaf68',
          chainTag: 74,
          blockRef: '0x000488f2985a9e16',
          expiration: 720,
          clauses: [
            {
              to: '0x35413c2384008128327b2cdc44100c149cd0a872',
              value: '0xa9bed2b4ed2de500000',
              data: '0x',
              address: {
                type: 'user',
              },
            },
          ],
          gasPriceCoef: 0,
          gas: 21000,
          origin: '0x13e8e179aae8811fd976fe37ad96a73012536a4e',
          nonce: '0xe6321fc019158693',
          dependsOn: null,
          size: 131,
          meta: {
            blockID: '0x000488f458f372029e762eddaa60f7a3cecdbe080ffcec8a09d2bf3ce3498a5a',
            blockNumber: 297204,
            blockTimestamp: 1533289450,
          },
        }, {
          id: '0x817059108536dfe95c31e01ef3dc68f5578d49acec7640af8cb24c6e8b1e9fa4',
          chainTag: 74,
          blockRef: '0x00046e73632655e2',
          expiration: 720,
          clauses: [
            {
              to: '0x13e8e179aae8811fd976fe37ad96a73012536a4e',
              value: '0x9f3e006e753df600000',
              data: '0x',
              address: {
                type: 'user',
              },
            },
          ],
          gasPriceCoef: 0,
          gas: 21000,
          origin: '0x9a0e8568cf7bacbbf42d53a87a9f6e6c25f0f6f0',
          nonce: '0xcc37e2dd851854b9',
          dependsOn: null,
          size: 131,
          meta: {
            blockID: '0x00046e74a1a3eec78ca234a599b12d3541d45dfec952f22c563edd848ece568b',
            blockNumber: 290420,
            blockTimestamp: 1533221600,
          },
        }];

        const vetTransaction = container.resolve('vetTransaction');

        await vetTransaction.addSettlementFunding(transactions1, ['0x817059108536dfe95c31e01ef3dc68f5578d49acec7640af8cb24c6e8b1e9fa4']);

        const result = await db('vet_transactions').select(['hash', 'clauseIndex', 'toAddress', 'toPath', 'toAddressId', 'fromAddress', 'state', 'type', 'walletId', 'blockHeight', 'currency']);

        result.should.deep.equal([{
          hash: '0x6d6c9fe6b557c99975dcc3119d5c04f59ebe60e8dc59f744e8aa37cbd6eb97df',
          clauseIndex: 0,
          toAddress: '0x9a514471efb92121bf2f597e4c234ad851b227f0',
          toPath: '0/1/0',
          toAddressId: 2,
          fromAddress: '0xa4adafaef9ec07bc4dc6de146934c7119341ee25',
          state: 'confirmed',
          type: 'funding_settlement',
          walletId: 1,
          blockHeight: 297204,
          currency: 'VET',
        }]);
      });
    });

    context('When `confirmedTxsHash` is empty', function () {
      it('should add all funding settlement transaction', async function () {
        const transactions1 = [{
          id: '0x6d6c9fe6b557c99975dcc3119d5c04f59ebe60e8dc59f744e8aa37cbd6eb97df',
          chainTag: 74,
          blockRef: '0x000488f367e7c254',
          expiration: 720,
          clauses: [
            {
              to: '0x9a514471efb92121bf2f597e4c234ad851b227f0',
              value: '0x8adb167cdbfd3890000',
              data: '0x',
              address: {
                type: 'settlement',
                path: '0/1/0',
                id: 2,
                walletId: 1,
              },
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
        }, {
          id: '0x3e022fde3de3bc3fc475084972442a4f7f96ff992af4dd9179e109dc89fbaf68',
          chainTag: 74,
          blockRef: '0x000488f2985a9e16',
          expiration: 720,
          clauses: [
            {
              to: '0x35413c2384008128327b2cdc44100c149cd0a872',
              value: '0xa9bed2b4ed2de500000',
              data: '0x',
              address: {
                type: 'user',
              },
            },
          ],
          gasPriceCoef: 0,
          gas: 21000,
          origin: '0x13e8e179aae8811fd976fe37ad96a73012536a4e',
          nonce: '0xe6321fc019158693',
          dependsOn: null,
          size: 131,
          meta: {
            blockID: '0x000488f458f372029e762eddaa60f7a3cecdbe080ffcec8a09d2bf3ce3498a5a',
            blockNumber: 297204,
            blockTimestamp: 1533289450,
          },
        }, {
          id: '0x817059108536dfe95c31e01ef3dc68f5578d49acec7640af8cb24c6e8b1e9fa4',
          chainTag: 74,
          blockRef: '0x00046e73632655e2',
          expiration: 720,
          clauses: [
            {
              to: '0x13e8e179aae8811fd976fe37ad96a73012536a4e',
              value: '0x9f3e006e753df600000',
              data: '0x',
              address: {
                type: 'user',
              },
            },
          ],
          gasPriceCoef: 0,
          gas: 21000,
          origin: '0x9a0e8568cf7bacbbf42d53a87a9f6e6c25f0f6f0',
          nonce: '0xcc37e2dd851854b9',
          dependsOn: null,
          size: 131,
          meta: {
            blockID: '0x00046e74a1a3eec78ca234a599b12d3541d45dfec952f22c563edd848ece568b',
            blockNumber: 290420,
            blockTimestamp: 1533221600,
          },
        }];

        const vetTransaction = container.resolve('vetTransaction');

        await vetTransaction.addSettlementFunding(transactions1);

        const result = await db('vet_transactions').select(['hash', 'clauseIndex', 'toAddress', 'toPath', 'toAddressId', 'fromAddress', 'state', 'type', 'walletId', 'blockHeight', 'currency']);

        result.should.deep.equal([{
          hash: '0x6d6c9fe6b557c99975dcc3119d5c04f59ebe60e8dc59f744e8aa37cbd6eb97df',
          clauseIndex: 0,
          toAddress: '0x9a514471efb92121bf2f597e4c234ad851b227f0',
          toPath: '0/1/0',
          toAddressId: 2,
          fromAddress: '0xa4adafaef9ec07bc4dc6de146934c7119341ee25',
          state: 'confirmed',
          type: 'funding_settlement',
          walletId: 1,
          blockHeight: 297204,
          currency: 'VET',
        }]);
      });
    });
  });

  describe('#addFundingTxs', function () {
    context('When `transactions` is null or empty', function () {
      it('should insert nothing', async function () {
        const vetTransaction = container.resolve('vetTransaction');

        await vetTransaction.addFundingTxs();

        const result = await db('vet_transactions');
        result.should.deep.equal([]);
      });
    });
  });

  describe('#getTotalMoveFundNeeded', function () {
    context('When `wallet` or `currency` is missing', function () {
      it('should throw error', async function () {
        const vetTransaction = container.resolve('vetTransaction');

        vetTransaction.getTotalMoveFundNeeded({}).should.be.rejectedWith('Missing `walletId` or `currency`');
      });
    });

    context('When can not calculate total', function () {
      it('should return 0', async function () {
        const vetTransaction = container.resolve('vetTransaction');

        const total = await vetTransaction.getTotalMoveFundNeeded({ walletId: 1, currency: 'VET' });

        total.should.equal(0);
      });
    });
  });

  describe('#getTotalMoveFundPending', function () {
    context('When `wallet` or `currency` is missing', function () {
      it('should throw error', async function () {
        const vetTransaction = container.resolve('vetTransaction');

        vetTransaction.getTotalMoveFundPending({}).should.be.rejectedWith('Missing `walletId` or `currency`');
      });
    });

    context('When can not calculate total', function () {
      it('should return 0', async function () {
        const vetTransaction = container.resolve('vetTransaction');

        const total = await vetTransaction.getTotalMoveFundPending({ walletId: 1, currency: 'VET' });

        total.should.equal(0);
      });
    });
  });

  describe('#addPendingWithdrawal', function () {
    context('When `currency` is missing', function () {
      it('should throw error', async function () {
        const vetTransaction = container.resolve('vetTransaction');

        vetTransaction.addPendingWithdrawal({}).should.be.rejectedWith('Missing `currency`');
      });
    });

    context('When `walletId` is missing', function () {
      it('should throw error', async function () {
        const vetTransaction = container.resolve('vetTransaction');

        vetTransaction.addPendingWithdrawal({ currency: 'VET' }).should.be.rejectedWith('Missing `walletId`');
      });
    });
  });

  describe('#addPendingMoveFund', function () {
    context('When `currency` is missing', function () {
      it('should throw error', async function () {
        const vetTransaction = container.resolve('vetTransaction');

        vetTransaction.addPendingMoveFund({}).should.be.rejectedWith('Missing `currency`');
      });
    });

    context('When `walletId` is missing', function () {
      it('should throw error', async function () {
        const vetTransaction = container.resolve('vetTransaction');

        vetTransaction.addPendingMoveFund({ currency: 'VET' }).should.be.rejectedWith('Missing `walletId`');
      });
    });
  });
});
