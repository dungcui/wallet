const chai = require('chai');
const rewire = require('rewire');

const server = rewire('../../src/app/server');

const { expect } = chai;
chai.should();

describe('server', function () {
  // Callback
  describe('#buildProtoService', function () {
    const buildProtoService = server.__get__('buildProtoService');
    let protoService;
    beforeEach(function () {
      const tokens = [{ service: 'STELLAR', currency: 'SIX' }];
      const services = [{
        currencies: ['BTC'],
        name: 'BTC',
        async getStatus(req) {
          req.currency.should.equal('BTC');
          return {
            totalBalance: '10',
            availableBalance: '8',
            availableWithdrawal: '7',
          };
        },
        async throwError(req) {
          req.currency.should.equal('BTC');
          throw Error('Something went wrong');
        }
      }, {
        currencies: ['QASH', 'RKT'],
        name: 'ERC20',
        async getStatus(req) {
          req.currency.should.be.oneOf(this.currencies);
          return {
            totalBalance: '1',
            availableBalance: '2',
            availableWithdrawal: '3',
          };
        },
        async throwError(req) {
          req.currency.should.be.oneOf(this.currencies);
          throw Error('Something went wrong');
        }
      }, {
        currency: 'XLM',
        name: 'STELLAR',
        async getStatus(req) {
          req.currency.should.be.oneOf(['SIX']);
          return {
            totalBalance: '1',
            availableBalance: '2',
            availableWithdrawal: '3',
          };
        },
        async throwError(req) {
          req.currency.should.be.oneOf(['SIX']);
          throw Error('Something went wrong');
        }
      }];
      const methods = ['getStatus', 'throwError', 'ping'];
      protoService = buildProtoService(methods, services, tokens);
    });

    it('should call normal method without error (BTC)', function (done) {
      protoService.getStatus({ request: { currency: 'BTC' } }, function (err, result) {
        try {
          expect(err).to.be.null;
          result.should.eql({
            total_balance: '10',
            available_balance: '8',
            available_withdrawal: '7',
          });
          done();
        } catch (err) {
          done(err);
        }
      });
    });

    it('should call normal method without error (QASH)', function (done) {
      protoService.getStatus({ request: { currency: 'QASH' } }, function (err, result) {
        try {
          expect(err).to.be.null;
          result.should.eql({
            total_balance: '1',
            available_balance: '2',
            available_withdrawal: '3',
          });
          done();
        } catch (err) {
          done(err);
        }
      });
    });

    it('should call default ping method', function (done) {
      protoService.ping({ request: {} }, function (err, result) {
        try {
          expect(err).to.be.null;
          Number(result.time).should.lte(new Date().getTime());
          done();
        } catch (err) {
          done(err);
        }
      });
    });

    it('should throw error on missing currency', function (done) {
      protoService.getStatus({ request: {} }, function (err, result) {
        try {
          err.should.be.an('error');
          err.message.should.equal('Missing currency');
          expect(result).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      });
    });

    it('should throw error on unsupported currency', function (done) {
      protoService.getStatus({ request: { currency: 'NOT-A-CURRENCY' } }, function (err, result) {
        try {
          err.should.be.an('error');
          err.message.should.equal('Currency is not supported');
          expect(result).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      });
    });

    it('should throw error on error method (BTC)', function (done) {
      protoService.throwError({ request: { currency: 'BTC' } }, function (err, result) {
        try {
          err.should.be.an('error');
          err.message.should.equal('Something went wrong');
          expect(result).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      });
    });

    it('should throw error on error method (RKT)', function (done) {
      protoService.throwError({ request: { currency: 'RKT' } }, function (err, result) {
        try {
          err.should.be.an('error');
          err.message.should.equal('Something went wrong');
          expect(result).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      });
    });

    it('should throw error on error method (SIX)', function (done) {
      protoService.throwError({ request: { currency: 'SIX' } }, function (err, result) {
        try {
          err.should.be.an('error');
          err.message.should.equal('Something went wrong');
          expect(result).to.be.undefined;
          done();
        } catch (err) {
          done(err);
        }
      });
    });
  });
});
