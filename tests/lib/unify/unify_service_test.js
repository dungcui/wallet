const chai = require('chai');
const knex = require('knex');
const awilix = require('awilix');
const chaiAsPromised = require('chai-as-promised');
const { create: createContainer } = require('../../../src/container');

chai.use(chaiAsPromised);
chai.should();

const { expect } = chai;

const transaction1 = require('./transaction_1.json');
const transaction2 = require('./transaction_2.json');
const transaction3 = require('./transaction_3.json');
const transaction4 = require('./transaction_4.json');

const signedTransaction = require('./signed_transaction.json');

// The unify service will be tested by:
// addWallet + getAddress: 2 scenario when using settlement and xpub
// bundleTransaction + broadcast: use base currency as UNIFY and token currency as TOKEN
describe('UnifyService', function () {
  let container;
  let db;

  beforeEach(async function () {
    container = createContainer();

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

    // Set default config for stellar because the unify will mock some function to stellar
    container.register('STELLAR_SLEEP_TIME', awilix.asValue(1));
    container.register('STELLAR_ITEM_PER_PAGE', awilix.asValue(200));
    container.register('STELLAR_START_BLOCK_HEIGHT', awilix.asValue(1));
    container.register('STELLAR_MINIMUM_CONFIRMATION', awilix.asValue(1));
    container.register('STELLAR_API_URL', awilix.asValue('https://horizon.stellar.org'));

    // Set default config for ontology because the unify will mock some function to ontology
    container.register('ONTOLOGY_BASE_FEE', awilix.asValue(0.01));
    container.register('ONTOLOGY_SLEEP_TIME', awilix.asValue(5));
    container.register('ONTOLOGY_API_TIMEOUT', awilix.asValue(5000));
    container.register('ONTOLOGY_MINIMUM_CONFIRMATION', awilix.asValue(5));
    container.register('ONTOLOGY_START_BLOCK_HEIGHT', awilix.asValue(289974));
    container.register('ONTOLOGY_FETCH_BLOCK_CONCURRENCY', awilix.asValue(10));
    container.register('ontologyApiUrl', awilix.asValue('http://polaris1.ont.io:20334'));

    // Run migrations
    await db.migrate.latest();

    // Test data for wallet using Settlement Address
    const [settlementId] = await db('wallets').insert({
      service: 'UNIFY',
      settlementAddress: 'GA7OPN4A3JNHLPHPEWM4PJDOYYDYNZOM7ES6YL3O7NC3PRY3V3UX6ANM',
    });
    await db('addresses').insert({
      memo: null,
      path: '0/1/0',
      service: 'UNIFY',
      type: 'settlement',
      address: 'settlement',
      walletId: settlementId,
    });

    // Test data for wallet using XPUB
    const [xpubId] = await db('wallets').insert({
      service: 'UNIFY',
      xpubs: 'xpub661MyMwAqRbcFAHX6T2C66buGtyJGUHzDFmV1f3GScTEhZkP6uc7GbFE9rzaDEqKUKTpzELCbYw9B8PQcvSz5an1iBuQVBoaCQiZYPK7b2p',
    });
    await db('addresses').insert({
      memo: null,
      path: '0/1/0',
      service: 'UNIFY',
      walletId: xpubId,
      type: 'settlement',
      address: 'settlement',
    });

    // Test data for token
    await db('tokens').insert({
      enabled: true,
      service: 'UNIFY',
      currency: 'TOKEN',
      address: 'TOKEN ISSUER',
    });

    // Test data for funding (for computing balances)
    await db('fundings').insert({
      amount: 10,
      addressId: 1,
      blockHeight: 1,
      outputIndex: 0,
      type: 'funding',
      service: 'UNIFY',
      currency: 'UNIFY',
      state: 'confirmed',
      transactionHash: 'cc8ec9b702da4be204618bc41131b71467cda18f33f63b45d208c3cbc68d5a5b',
    });
    await db('fundings').insert({
      amount: 10,
      addressId: 2,
      blockHeight: 2,
      outputIndex: 0,
      type: 'funding',
      service: 'UNIFY',
      currency: 'TOKEN',
      state: 'confirmed',
      transactionHash: 'dc9ec9b702da4be204618bc41131b71467cda18f33f63b45d208c3cbc68d5a5b',
    });

    // Preload the database token:
    const tokens = container.resolve('token');
    await tokens.preload(['UNIFY']);
  });

  afterEach(async function () {
    await db.migrate.rollback();
    await db.destroy();
  });

  describe('#addWallet', function () {
    context('Settlement Wallet: when calling addWallet', function () {
      it('should call validateWallet and add new wallet with address to database', async function () {
        const service = container.resolve('unifyService');

        const validateWalletSpy = chai.spy.on(service, 'validateWallet');

        // Mock derive from Stellar Interpreter
        service.interpreter.derive = container.resolve('stellarInterpreter').derive;

        const request = {
          xpubs: [],
          currency: 'unify',
          settlementAddress: 'GBBE7LZCXCUJNKFOZHNXLJV7BOJ64LUT7YZMC6IWWGFK7W347BJ5WMZR',
        };

        // Call add wallet
        const { id, changeAddress } = await service.addWallet(request);

        // It should call validateWallet
        validateWalletSpy.should.have.been.called.with(request);

        // Check Wallet
        const wallet = await db('wallets').where({ id }).first();
        wallet.id.should.be.equal(id);
        wallet.service.should.be.equal('UNIFY');
        wallet.settlementAddress.should.be.equal(changeAddress);
        wallet.xpubs.length.should.be.equal(0);
        expect(wallet.minimum).to.be.null;

        // Check Address
        const address = await db('addresses').where({ address: changeAddress }).first();
        address.walletId.should.be.equal(id);
        address.path.should.be.equal('0/1/0');
        address.service.should.be.equal('UNIFY');
        address.type.should.be.equal('settlement');
        address.address.should.be.equal(changeAddress);
        expect(address.memo).to.be.null;
      });
    });

    context('XPUB Wallet: when calling addWallet', function () {
      it('should call validateWallet and add new wallet with address to database', async function () {
        const service = container.resolve('unifyService');

        const validateWalletSpy = chai.spy.on(service, 'validateWallet');

        // Mock derive from Ontology Interpreter
        service.interpreter.derive = container.resolve('ontologyInterpreter').derive;

        const request = {
          currency: 'unify',
          xpubs: ['xpub661MyMwAqRbcFAHX6T2C66buGtyJGUHzDFmV1f3GScTEhZkP6uc7GbFE9rzaDEqKUKTpzELCbYw9B8PQcvSz5an1iBuQVBoaCQiZYPK7b2p'],
        };

        // Call add wallet
        const { id, changeAddress } = await service.addWallet(request);

        // It should call validateWallet
        validateWalletSpy.should.have.been.called.with(request);

        // Check Wallet
        const wallet = await db('wallets').where({ id }).first();
        wallet.id.should.be.equal(id);
        wallet.service.should.be.equal('UNIFY');
        wallet.xpubs.should.be.equal(request.xpubs[0]);
        wallet.settlementAddress.should.be.equal(changeAddress);
        expect(wallet.minimum).to.be.null;

        // Check Address
        const address = await db('addresses').where({ address: changeAddress }).first();
        address.walletId.should.be.equal(id);
        address.path.should.be.equal('0/1/0');
        address.service.should.be.equal('UNIFY');
        address.type.should.be.equal('settlement');
        address.address.should.be.equal(changeAddress);
        expect(address.memo).to.be.null;
      });
    });
  });

  describe('#generateAddress', function () {
    context('Settlement Wallet: when calling generateAddress', function () {
      it('should add to database address and return address + memo', async function () {
        const service = container.resolve('unifyService');

        // Mock derive from Stellar Interpreter
        service.interpreter.derive = container.resolve('stellarInterpreter').derive;

        // a sample request for testing
        const settlementAddress = 'GBBE7LZCXCUJNKFOZHNXLJV7BOJ64LUT7YZMC6IWWGFK7W347BJ5WMZR';
        const request = {
          wallet: {
            id: 3,
            service: 'UNIFY',
            settlementAddress,
            createdAt: '2018-10-02 09:52:09',
          },
          path: '0/1/2',
        };
        const { count: before } = await db('addresses').count('id as count').first();
        const { address, memo } = await service.generateAddress(request);
        const { count: after } = await db('addresses').count('id as count').first();

        after.should.be.equal(before + 1);
        address.should.be.equal(settlementAddress);
        expect(memo).to.not.be.null;
      });
    });

    context('XPUB Wallet: when calling generateAddress', function () {
      it('should add to database address and return address', async function () {
        const service = container.resolve('unifyService');

        // Mock derive from Ontology Interpreter
        service.interpreter.derive = container.resolve('ontologyInterpreter').derive;

        // a sample request for testing
        const xpubs = 'xpub661MyMwAqRbcFAHX6T2C66buGtyJGUHzDFmV1f3GScTEhZkP6uc7GbFE9rzaDEqKUKTpzELCbYw9B8PQcvSz5an1iBuQVBoaCQiZYPK7b2p';
        const request = {
          wallet: {
            id: 3,
            xpubs,
            service: 'UNIFY',
            createdAt: '2018-10-02 09:52:09',
          },
          path: '0/1/2',
        };
        const { count: before } = await db('addresses').count('id as count').first();
        const { address, memo } = await service.generateAddress(request);
        const { count: after } = await db('addresses').count('id as count').first();

        after.should.be.equal(before + 1);
        expect(address).to.not.be.null;
        expect(memo).to.be.undefined;
      });
    });
  });

  describe('#getAddress', function () {
    context('when missing wallet id', function () {
      it('should throw error', async function () {
        const service = container.resolve('unifyService');
        await service.getAddress({
          path: '0/1/1',
        }).should.be.rejectedWith(Error, service.error.MISSING_WALLET_ID);
      });
    });

    context('when empty path', function () {
      it('should throw error', async function () {
        const service = container.resolve('unifyService');
        await service.getAddress({
          walletId: 1,
          path: '',
        }).should.be.rejectedWith(Error, service.error.EMPTY_PATH);
        await service.getAddress({
          walletId: 1,
        }).should.be.rejectedWith(Error, service.error.EMPTY_PATH);
      });
    });

    context('when wallet not found', function () {
      it('should throw error', async function () {
        const service = container.resolve('unifyService');
        await service.getAddress({
          walletId: 10,
          path: '0/1/1',
        }).should.be.rejectedWith(Error, service.error.WALLET_NOT_FOUND);
      });
    });

    context('Settlement Wallet: when received a new address', function () {
      it('should return the new hash', async function () {
        const service = container.resolve('unifyService');

        // Mock derive from Stellar Interpreter
        service.interpreter.derive = container.resolve('stellarInterpreter').derive;

        const { count: before } = await db('addresses').count('id as count').first();

        const { hash } = await service.getAddress({
          // WalletId of the settlement Wallet
          walletId: 1,
          path: '0/1/1',
        });

        const { count: after } = await db('addresses').count('id as count').first();

        after.should.be.equal(before + 1);

        // GA7OP is the settlement address created in beforeEach
        const { length } = 'GA7OPN4A3JNHLPHPEWM4PJDOYYDYNZOM7ES6YL3O7NC3PRY3V3UX6ANM';
        hash.slice(0, length).should.be.equal('GA7OPN4A3JNHLPHPEWM4PJDOYYDYNZOM7ES6YL3O7NC3PRY3V3UX6ANM');
      });
    });

    context('XPUB Wallet: when received a new address', function () {
      it('should return the new hash', async function () {
        const service = container.resolve('unifyService');

        // Mock derive from Ontology Interpreter
        service.interpreter.derive = container.resolve('ontologyInterpreter').derive;

        const { count: before } = await db('addresses').count('id as count').first();

        const { hash } = await service.getAddress({
          // WalletId of the xpub wallet
          walletId: 2,
          path: '0/1/1',
        });

        const { count: after } = await db('addresses').count('id as count').first();

        after.should.be.equal(before + 1);
        expect(hash).to.not.be.null;
      });
    });

    context('Settlement Wallet: when in database already has the address', function () {
      it('should return existing address', async function () {
        const service = container.resolve('unifyService');

        // setup db
        const memo = '6452797857020825600';
        const address = 'GA7OPN4A3JNHLPHPEWM4PJDOYYDYNZOM7ES6YL3O7NC3PRY3V3UX6ANM';
        await db('addresses').insert({
          memo,
          address,
          walletId: 1,
          path: '0/1/1',
          service: 'UNIFY',
          type: service.addresses.type.USER,
        });

        // This is the hash format when call getAddress
        const hashBefore = `${address},memo_text:${memo}`;
        const { count: before } = await db('addresses').count('id as count').first();

        const { hash: hashAfter } = await service.getAddress({
          // WalletId of the settlement Wallet
          walletId: 1,
          path: '0/1/1',
        });
        const { count: after } = await db('addresses').count('id as count').first();

        after.should.be.equal(before);
        hashAfter.should.be.equal(hashBefore);
      });
    });

    context('XPUB Wallet: when in database already has the address', function () {
      it('should return existing address', async function () {
        const service = container.resolve('unifyService');

        // setup db
        const address = 'AM7WeoLowVKc9XT1xFLHuSJjsUgifxZYUM';
        await db('addresses').insert({
          address,
          walletId: 2,
          path: '0/1/1',
          service: 'UNIFY',
          type: service.addresses.type.USER,
        });

        // This is the hash format when call getAddress
        const { count: before } = await db('addresses').count('id as count').first();

        const { hash } = await service.getAddress({
          // WalletId of the settlement Wallet
          walletId: 2,
          path: '0/1/1',
        });
        const { count: after } = await db('addresses').count('id as count').first();

        after.should.be.equal(before);
        address.should.be.equal(hash);
      });
    });
  });

  describe('#bundleTransactions', function () {
    const transactions = [transaction1];
    context('when missing wallet id', function () {
      it('should throw error', async function () {
        const service = container.resolve('unifyService');
        await service.bundleTransactions({
          transactions,
          type: 'something',
          currency: 'something',
        }).should.be.rejectedWith(Error, service.error.MISSING_WALLET_ID);
      });
    });

    context('when missing transactions', function () {
      it('should throw error', async function () {
        const service = container.resolve('unifyService');
        await service.bundleTransactions({
          walletId: 1,
          type: 'something',
          currency: 'something',
        }).should.be.rejectedWith(Error, service.error.MISSING_TRANSACTIONS);
      });
    });

    context('when calling with type move fund', function () {
      it('should call bundleMoveFund', async function () {
        const service = container.resolve('unifyService');
        const bundleMoveFund = chai.spy.on(service, 'bundleMoveFund');

        const request = {
          walletId: 1,
          transactions,
          currency: 'something',
          type: service.bundleType.MOVE_FUND,
        };
        await service.bundleTransactions(request)
          .should.be.rejectedWith(Error, service.error.MOVE_FUND_NOT_IMPLEMENTED);
        // It should call bundleMoveFund
        bundleMoveFund.should.have.been.called.with(request);
      });
    });

    context('when calling with type withdrawal', function () {
      it('should call bundleWithdrawal', async function (done) {
        const service = container.resolve('unifyService');
        const bundleWithdrawal = chai.spy.on(service, 'bundleWithdrawal', done());

        const request = {
          walletId: 1,
          transactions,
          currency: 'something',
          type: service.bundleType.WITHDRAWAL,
        };

        container.resolve('unifyInterpreter').getMeta = async () => '';

        await service.bundleTransactions(request);
        // It should call bundleWithdrawal
        bundleWithdrawal.should.have.been.called.with(request);
      });
    });
  });

  describe('capTransaction', function () {
    context('when not enough balance because of fee', function () {
      it('should return payload with no transaction', async function () {
        const service = container.resolve('unifyService');
        const availableWithdrawals = await service.computeAvailableWithdrawals({ id: 1 });
        const transactions = service.capTransaction(
          availableWithdrawals,
          [transaction1],
        );
        transactions.length.should.be.equal(0);
      });
    });

    context('when not enough balance for grossAmount', function () {
      it('should return payload with no transaction', async function () {
        const service = container.resolve('unifyService');
        const availableWithdrawals = await service.computeAvailableWithdrawals({ id: 1 });
        const transactions = service.capTransaction(
          availableWithdrawals,
          [transaction3],
        );
        transactions.length.should.be.equal(0);
      });
    });

    context('when enough balance', function () {
      it('should return payload', async function () {
        const service = container.resolve('unifyService');
        const availableWithdrawals = await service.computeAvailableWithdrawals({ id: 1 });
        const transactions = service.capTransaction(
          availableWithdrawals,
          [transaction2, transaction4],
        );
        transactions.length.should.be.equal(2);
      });
    });
  });

  describe('#bundleWithdrawal', function () {
    context('when wallet not found', function () {
      it('should throw error', async function () {
        const service = container.resolve('unifyService');
        const transactions = [transaction1, transaction2];
        await service.bundleWithdrawal({
          // no wallet with this id
          walletId: 10,
          transactions,
        }).should.be.rejectedWith(Error, service.error.WALLET_NOT_FOUND);
      });
    });

    context('when having valid input', function () {
      it('should bundle transactions', async function () {
        const service = container.resolve('unifyService');

        container.resolve('unifyInterpreter').getMeta = async () => '';

        const { payload } = await service.bundleWithdrawal({
          walletId: 1,
          transactions: [transaction2, transaction4],
        });
        const { type, transactions, meta } = JSON.parse(payload);

        type.should.be.equal('withdrawal');
        transactions.length.should.be.equal(2);
        JSON.stringify(meta).should.be.equal(JSON.stringify(await service.interpreter.getMeta()));
      });
    });
  });

  describe('#getIssuer', function () {
    context('when receive native currency', function () {
      it('should return native', async function () {
        const service = container.resolve('unifyService');
        const issuer = await service.getIssuer('UNIFY');
        issuer.should.be.equal('native');
      });
    });

    context('when receive token', function () {
      it('should return issuer of the token', async function () {
        const service = container.resolve('unifyService');
        const issuer = await service.getIssuer('TOKEN');
        issuer.should.be.equal('TOKEN ISSUER');
      });
    });
  });

  describe('#computeTotalBalances', function () {
    it('should compute total balances for the wallet', async function () {
      const service = container.resolve('unifyService');
      const balances = await service.computeAvailableWithdrawals({ id: 1 });

      // get balance of currency: TOKEN, UNIFY and SOMETHING
      const { TOKEN } = balances;
      const { UNIFY } = balances;
      const { SOMETHING } = balances;

      expect(TOKEN).to.not.be.null;
      expect(UNIFY).to.not.be.null;
      expect(SOMETHING).to.be.undefined;
      UNIFY.issuer.should.be.equal('native');
      TOKEN.issuer.should.be.equal('TOKEN ISSUER');
    });
  });

  describe('#computeAvailableBalances', function () {
    it('should compute available balances', async function () {
      const service = container.resolve('unifyService');

      const totalBalances = await service.computeTotalBalances({ id: 1 });
      const availableBalances = await service.computeAvailableBalances({ id: 1 }, totalBalances);

      const { TOKEN: totalToken, UNIFY: totalUnify } = totalBalances;
      const { TOKEN: availToken, UNIFY: availUnify } = availableBalances;

      JSON.stringify(totalToken).should.be.equal(JSON.stringify(availToken));
      JSON.stringify(totalUnify).should.be.equal(JSON.stringify(availUnify));
    });
  });

  describe('#computeAvailableWithdrawals', function () {
    it('should compute available withdrawal for the wallet', async function () {
      const service = container.resolve('unifyService');
      const balances = await service.computeAvailableWithdrawals({ id: 1 });

      // get balance of currency: TOKEN, UNIFY and SOMETHING
      const { TOKEN } = balances;
      const { UNIFY } = balances;
      const { SOMETHING } = balances;

      expect(TOKEN).to.not.be.null;
      expect(UNIFY).to.not.be.null;
      expect(SOMETHING).to.be.undefined;
      UNIFY.issuer.should.be.equal('native');
      TOKEN.issuer.should.be.equal('TOKEN ISSUER');
    });
  });

  describe('#getStatus', function () {
    context('when missing wallet id', function () {
      it('should throw error', async function () {
        const service = container.resolve('unifyService');
        await service.getStatus({
          currency: 'UNIFY',
        }).should.be.rejectedWith(Error, service.error.MISSING_WALLET_ID);
      });
    });

    context('when missing currency', function () {
      it('should throw error', async function () {
        const service = container.resolve('unifyService');
        await service.getStatus({
          walletId: 1,
        }).should.be.rejectedWith(Error, service.error.MISSING_CURRENCY);
      });
    });

    context('when having valid input', function () {
      it('should return balances of the wallet', async function () {
        const service = container.resolve('unifyService');
        const balances = await service.getStatus({
          walletId: 1,
          currency: 'UNIFY',
        });
        const { totalBalance, availableBalance, availableWithdrawal } = balances;
        totalBalance.should.be.equal('10');
        availableBalance.should.be.equal('10');
        availableWithdrawal.should.be.equal('10');
      });
    });
  });

  describe('#checkDuplicatedWithdrawal', function () {
    context('when receive duplicated withdrawal', function () {
      it('should throw error', async function () {
        const externalId = 10;
        const transactionHash = '8df560cacc61930a490df45d143eaf0e1fa2b4722f7f91ee0c17d0e6d6674cce';

        // Prepare db for duplicated transaction Hash
        await db('withdrawals').insert({
          amount: 10,
          outputIndex: 0,
          transactionHash,
          service: 'UNIFY',
          currency: 'UNIFY',
          state: 'confirmed',
          toAddress: 'something',
          externalId: 'something',
        });

        // Prepare db for duplicated external Id
        await db('withdrawals').insert({
          externalId,
          amount: 10,
          outputIndex: 0,
          service: 'UNIFY',
          currency: 'UNIFY',
          state: 'confirmed',
          toAddress: 'something',
          transactionHash: 'something',
        });

        const service = container.resolve('unifyService');

        await service.checkDuplicatedWithdrawal(
          null, // externalId
          transactionHash,
        ).should.be.rejectedWith(Error, service.error.DUPLICATED_WITHDRAWAL);
        await service.checkDuplicatedWithdrawal(
          externalId,
          null, // transactionHash
        ).should.be.rejectedWith(Error, service.error.DUPLICATED_WITHDRAWAL);
      });
    });
    context('when not receive duplicated withdrawal', function () {
      it('should not throw any error', async function () {
        const service = container.resolve('unifyService');
        const transactionHash = '8df560cacc61930a490df45d143eaf0e1fa2b4722f7f91ee0c17d0e6d6674cce';

        await service.checkDuplicatedWithdrawal(
          null, // externalId
          transactionHash,
        ).should.not.be.rejected;
      });
    });
  });

  describe('#broadcastAndCreateWithdrawal', function () {
    context('when call api broadcast failed', function () {
      it('should return null', async function () {
        const service = container.resolve('unifyService');
        const stellarInterpreter = container.resolve('stellarInterpreter');

        // Mock broadcast function to be failed
        service.api.broadcast = async () => {
          throw new Error();
        };

        // Mock the deserialize to be stellar
        service.interpreter.deserializeTx = stellarInterpreter.deserializeTx;
        service.interpreter.getCurrencyOfOperation = stellarInterpreter.getCurrencyOfOperation;
        service.interpreter.buildBroadcastedWithdrawals = stellarInterpreter.buildBroadcastedWithdrawals;

        const rawTransaction = signedTransaction.transactions_hash['1'];
        const hash = await service.broadcastAndCreateWithdrawal(1, rawTransaction);

        // hash should be null
        expect(hash).to.be.null;
      });
    });
    context('when call api broadcast successfully', function () {
      it('should return the hash of transaction and update withdrawal db', async function () {
        const service = container.resolve('unifyService');
        const stellarInterpreter = container.resolve('stellarInterpreter');

        // Mock broadcast function to be successful and return nothing as response
        service.api.broadcast = async () => '';

        // Mock the deserialize to be stellar
        service.interpreter.deserializeTx = stellarInterpreter.deserializeTx;
        service.interpreter.getCurrencyOfOperation = stellarInterpreter.getCurrencyOfOperation;
        service.interpreter.buildBroadcastedWithdrawals = stellarInterpreter.buildBroadcastedWithdrawals;

        // Number of record of withdrawal before
        const { count: before } = await db('withdrawals').count('id as count').first();
        const rawTransaction = signedTransaction.transactions_hash['1'];

        const hash = await service.broadcastAndCreateWithdrawal(1, rawTransaction);

        // Number of record of withdrawal before
        const { count: after } = await db('withdrawals').count('id as count').first();

        // Database Withdrawal should be updated
        after.should.be.equal(before + 1);
        expect(hash).to.not.be.null;
      });
    });
  });

  describe('#broadcast', function () {
    context('when missing payload', function () {
      it('should throw error', async function () {
        const service = container.resolve('unifyService');
        await service.broadcast({}).should.be.rejectedWith(Error, service.error.MISSING_PAYLOAD);
      });
    });
    context('when input is valid', function () {
      it('should broadcast and update withdrawal db', async function () {
        const service = container.resolve('unifyService');
        const stellarInterpreter = container.resolve('stellarInterpreter');
        const { transactions_hash: transactionsHash } = signedTransaction;

        // Mock broadcast function to be successful and return nothing as response
        service.api.broadcast = async () => '';

        // Mock the deserialize to be stellar
        service.interpreter.deserializeTx = stellarInterpreter.deserializeTx;
        service.interpreter.getCurrencyOfOperation = stellarInterpreter.getCurrencyOfOperation;
        service.interpreter.buildBroadcastedWithdrawals = stellarInterpreter.buildBroadcastedWithdrawals;

        // Number of record of withdrawal before
        const { count: before } = await db('withdrawals').count('id as count').first();

        // Call broadcast
        const { payload: broadcastResponse } = await service.broadcast({
          payload: JSON.stringify(signedTransaction),
        });
        const payload = JSON.parse(broadcastResponse);

        // Number of record of withdrawal after
        const { count: after } = await db('withdrawals').count('id as count').first();

        const numberOfHash = Object.keys(transactionsHash).length;

        // It should add all of transactionsHash to withdrawal
        after.should.be.equal(before + numberOfHash);
        Object.keys(payload).length.should.be.equal(numberOfHash);
      });
    });
  });
});
