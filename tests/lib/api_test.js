const chai = require('chai');
const awilix = require('awilix');
const chaiAsPromised = require('chai-as-promised');
const { create: createContainer } = require('../../src/container');
const sinon = require('sinon');

let container;
chai.use(chaiAsPromised);
chai.should();
this.timeout = 1000;

describe('Api', function () {
  this.timeout(10000);

  beforeEach(function () {
    container = createContainer();

    container.register('sleepTime', awilix.asValue(1));
    container.register('baseUrl', awilix.asValue('https://api.kryptoniex.com/internal/scrypto-transactions/'));
    container.register('maxAttempt', awilix.asValue(1));
    container.register('timeout', awilix.asValue(5000));
  });

  // describe('#get', function () {
  //   context('When url is valid', function () {
  //     it('should fetch data from url', async function () {
  //       const api = container.resolve('api');
  //       const result = await api.get('todos/1');

  //       result.should.deep.equal({
  //         userId: 1,
  //         id: 1,
  //         title: 'delectus aut autem',
  //         completed: false,
  //       });
  //     });
  //   });

  //   context('When url is invalid', function () {
  //     it('should retry to fetch data at least once', async function () {
  //       container.register('baseUrl', awilix.asValue('http://foo.bar/'));

  //       const api = container.resolve('api');

  //       sinon.spy(api, 'get');

  //       try {
  //         await api.get('1');
  //       } catch (err) {
  //         err.should.exist;
  //       }

  //       api.get.calledTwice.should.be.true;
  //     });
  //   });

  //   context('When url is invalid but MAX_ATTEMPT is 0', function () {
  //     it('should throw error without any retry', async function () {
  //       container.register('baseUrl', awilix.asValue('http://foo.bar/'));
  //       container.register('maxAttempt', awilix.asValue(0));
  //       const api = container.resolve('api');

  //       sinon.spy(api, 'get');

  //       try {
  //         await api.get('1');
  //       } catch (err) {
  //         err.should.exist;
  //       }

  //       api.get.calledOnce.should.be.true;
  //     });
  //   });
  // });

  describe('#post', function () {
    context('When post valid data', function () {
      it('should success', async function () {
        const api = container.resolve('api');

        const result = await api.post('notify', {
          userId: 1,
          title: 'delectus aut autem',
          completed: true,
        });

        result.id.should.exist;
        delete result.id;
        result.should.deep.equal({
          userId: 1,
          title: 'delectus aut autem',
          completed: true,
        });
      });
    });
  });

  describe('#validateRequest', function () {
    context('When response status is > 202', function () {
      it('should throw error', async function () {
        const api = container.resolve('api');

        const raw = {
          status: 203,
          text: () => {},
        };

        sinon.stub(raw, 'text').returns('random request error');

        try {
          await api.constructor.validateRequest(raw);
        } catch (err) {
          err.message.should.equal('203 - random request error');
        }

        raw.text.called.should.be.true;
      });
    });

    context('When response status is <= 202', function () {
      it('should do nothing', async function () {
        const api = container.resolve('api');
        const raw = {
          status: 202,
          text: () => {},
        };

        sinon.spy(raw, 'text');

        await api.constructor.validateRequest(raw);
        raw.text.called.should.be.false;
      });
    });
  });
});
