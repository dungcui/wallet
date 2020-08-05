const { EventEmitter } = require('events');
const chai = require('chai');
const jwt = require('jsonwebtoken');
const { create: createWorker } = require('../../src/app/worker');
const snakeCaseKeys = require('snakecase-keys');

chai.should();

describe('worker', function () {
  process.env.BLOCKS_QUEUE_EXCHANGE = 'test_queue_exchange';
  process.env.NODE_ENV = 'development';
  process.env.SERVER_SECRET = 'abc';

  describe('#create', function () {
    it('should create worker', function (done) {
      const block = {
        height: 123,
        hash: 'abc',
        balancesHash: { foo: 'bar' },
        confirmedNetworkTxs: 12,
        isFastForward: true,
      };
      const snakeCaseBlock = snakeCaseKeys(block, { deep: false });
      const payload = jwt.sign(JSON.stringify(snakeCaseBlock), process.env.SERVER_SECRET);

      const channel = {
        assertExchange(exchange, type) {
          exchange.should.equal(process.env.BLOCKS_QUEUE_EXCHANGE);
          type.should.equal('fanout');
        },

        publish(exchange, routingKeys, buffer, options) {
          routingKeys.should.equal('');
          exchange.should.equal(process.env.BLOCKS_QUEUE_EXCHANGE);
          buffer.toString().should.equal(Buffer.from(payload).toString());
          options.persistent.should.equal(true);
        },
      };

      const balancesHash = {
        add(name, content) {
          name.should.equal('test_worker');
          JSON.parse(content).should.deep.equal(snakeCaseBlock);
        },
      };

      const monitor = new EventEmitter();
      const worker = createWorker({ monitor, channel, balancesHash });

      monitor.name = 'test_worker';
      worker.emit('block', block);
      setTimeout(() => done(), 10);
    });
  });
});
