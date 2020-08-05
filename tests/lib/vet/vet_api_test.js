const chai = require('chai');
const awilix = require('awilix');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const { create: createContainer } = require('../../../src/container');
const Decimal = require('decimal.js');

let container;
chai.use(chaiAsPromised);
chai.should();

const dummyApiUrl = 'http://dummyapiurl.com';

describe('VetApi', function () {
  this.timeout(10000);
  beforeEach(async function () {
    container = createContainer();

    container.register('vetApiSleepTime', awilix.asValue(10));
    container.register('vetApiTimeout', awilix.asValue(5000));
    container.register('vetApiUrl', awilix.asValue(dummyApiUrl));
  });


  describe('#getAccount(address)', function () {
    context('When address is missing', function () {
      it('Should throw error', async function () {
        const vetApi = container.resolve('vetApi');

        vetApi.getAccount().should.be.rejected;
      });
    });

    context('When account is found', function () {
      it('Should return account info', async function () {
        const vetApi = container.resolve('vetApi');

        const account = {
          balance: '0xde0b6b3a7640000',
          energy: '0xde0b6b3a7640000',
          hasCode: false,
        };

        sinon
          .stub(vetApi, 'get')
          .returns(account);

        const dummyAddress = '0xabc...';
        const result = await vetApi.getAccount(dummyAddress);

        result.should.deep.equal(account);
      });
    });
  });


  describe('#getBalance(address)', function () {
    context('When balance is found', function () {
      it('Should return balance', async function () {
        const vetApi = container.resolve('vetApi');

        const account = {
          balance: '0xde0b6b3a7640000',
          energy: '0xde0b6b3a7640000',
          hasCode: false,
        };

        sinon
          .stub(vetApi, 'getAccount')
          .returns(account);

        const dummyAddress = '0xabc...';
        const result = await vetApi.getBalance(dummyAddress);

        new Decimal(account.balance).toString().should.equal(result);
      });
    });
  });


  describe('#getEnergy(address)', function () {
    context('When balance is found', function () {
      it('Should return balance', async function () {
        const vetApi = container.resolve('vetApi');

        const account = {
          balance: '0xde0b6b3a7640000',
          energy: '0xde0b6b3a7640000',
          hasCode: false,
        };

        sinon
          .stub(vetApi, 'getAccount')
          .returns(account);

        const dummyAddress = '0xabc...';
        const result = await vetApi.getEnergy(dummyAddress);

        new Decimal(account.energy).toString().should.equal(result);
      });
    });
  });


  describe('#sendSignedTransaction(raw)', function () {
    context('When `raw` is missing', function () {
      it('Should throw error', async function () {
        const vetApi = container.resolve('vetApi');

        vetApi
          .sendSignedTransaction()
          .should.be.rejectedWith('`raw` is missing');
      });
    });

    context('When sending transaction successful', function () {
      it('Should return transactions hash', async function () {
        const vetApi = container.resolve('vetApi');
        const dummyRawTx = '0xabc...';
        const dummyResult = { id: '0xabcresult...' };

        sinon
          .stub(vetApi, 'post')
          .returns(dummyResult);

        const result = await vetApi.sendSignedTransaction(dummyRawTx);

        vetApi
          .post
          .calledWith('transactions', { raw: dummyRawTx })
          .should.be.true;


        result.should.equal(dummyResult.id);
      });
    });
  });

  describe('#getBlock(revision)', function () {
    context('When `revision` is a number', function () {
      it('Should return block info', async function () {
        const vetApi = container.resolve('vetApi');
        const dummyBlock = {
          number: 282725,
          id: '0x000450654d06cd16ac5cb95d485c56c18efb8a5da93e29f7c3ee1a789011fc24',
          transactions: [
            '0x0391913175b621954773bfb0c55a2318aa1266c815f3fa0da9272297195dc788',
          ],
        };

        sinon
          .stub(vetApi, 'get')
          .returns(dummyBlock);

        const dummyRevision = 1000;
        const block = await vetApi.getBlock(dummyRevision);

        block.should.deep.equal(dummyBlock);
        vetApi.get
          .calledWith(`blocks/${dummyRevision}`)
          .should.be.true;
      });
    });

    context('When `revision` is "best"', function () {
      it('Should return best block info', async function () {
        const vetApi = container.resolve('vetApi');
        const dummyBlock = {
          number: 282725,
          id: '0x000450654d06cd16ac5cb95d485c56c18efb8a5da93e29f7c3ee1a789011fc24',
          transactions: [
            '0x0391913175b621954773bfb0c55a2318aa1266c815f3fa0da9272297195dc788',
          ],
        };

        sinon
          .stub(vetApi, 'get')
          .returns(dummyBlock);

        const dummyRevision = 'best';
        const block = await vetApi.getBlock(dummyRevision);

        block.should.deep.equal(dummyBlock);
        vetApi.get
          .calledWith('blocks/best')
          .should.be.true;
      });
    });

    context('When `revision` is missing or is string but not "best"', function () {
      it('Should return best block instead', async function () {
        const vetApi = container.resolve('vetApi');
        const dummyBlock = {
          number: 282725,
          id: '0x000450654d06cd16ac5cb95d485c56c18efb8a5da93e29f7c3ee1a789011fc24',
          transactions: [
            '0x0391913175b621954773bfb0c55a2318aa1266c815f3fa0da9272297195dc788',
          ],
        };

        sinon
          .stub(vetApi, 'get')
          .returns(dummyBlock);

        const block1 = await vetApi.getBlock(undefined);
        const block2 = await vetApi.getBlock(null);
        const block3 = await vetApi.getBlock('dummytext');

        block1.should.deep.equal(dummyBlock);
        block2.should.deep.equal(dummyBlock);
        block3.should.deep.equal(dummyBlock);

        vetApi.get
          .alwaysCalledWith('blocks/best')
          .should.be.true;
      });
    });

    context('When block not found', function () {
      it('Should return undefined or null', async function () {
        const vetApi = container.resolve('vetApi');

        sinon
          .stub(vetApi, 'get')
          .returns(null);

        const notExistBlockNumber = 10000000000000;
        const block = await vetApi.getBlock(notExistBlockNumber);

        (!block).should.be.true;
        vetApi.get
          .calledWith(`blocks/${notExistBlockNumber}`)
          .should.be.true;
      });
    });
  });

  describe('#getLatestBlockHeight()', function () {
    it('Should return block number of best block', async function () {
      const vetApi = container.resolve('vetApi');
      const dummyBestBlock = {
        number: 282725,
        id: '0x000450654d06cd16ac5cb95d485c56c18efb8a5da93e29f7c3ee1a789011fc24',
        transactions: [
          '0x0391913175b621954773bfb0c55a2318aa1266c815f3fa0da9272297195dc788',
        ],
      };

      sinon
        .stub(vetApi, 'get')
        .returns(dummyBestBlock);

      const blockNumber = await vetApi.getLatestBlockHeight();

      blockNumber.should.equal(dummyBestBlock.number);
    });
  });

  describe('#getTransaction(txHash)', function () {
    context('When `txHash` is missing', function () {
      it('Should throw error', async function () {
        const vetApi = container.resolve('vetApi');

        vetApi
          .getTransaction()
          .should.be.rejectedWith('`txHash` is missing');
      });
    });

    context('When `txHash` is provided', function () {
      it('Should return transaction info', async function () {
        const vetApi = container.resolve('vetApi');
        const dummyTx = {
          id: '0xea3de514071e5b9aa2176e9e6db2f0b70792d425db7dd2ed9faf1da12afda83b',
          chainTag: 74,
          clauses: [
            {
              to: '0xf7370f50549e16c71077553b1e8a75bd72c0aaf0',
              value: '0x1a77ecbd63baddef00000',
              data: '0x',
            },
          ],
          gas: 63000,
        };

        sinon
          .stub(vetApi, 'get')
          .returns(dummyTx);

        const tx = await vetApi.getTransaction(dummyTx.id);

        tx.should.deep.equal(dummyTx);
        vetApi.get
          .calledWith(`transactions/${dummyTx.id}`)
          .should.be.true;
      });
    });
  });
});
