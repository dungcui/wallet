const kafka = require('kafka-node');
const debug = require('debug')('wallet:worker');

const { KafkaClient, Producer } = kafka;
const create = () => {
  const url =
    process.env.KAFKA_CONNECT_URL ||
    '202.143.111.190:32770,202.143.111.190:32769,202.143.111.190:32768';
  const client = new KafkaClient({
    kafkaHost: url,
  });
  const producer = new Producer(client);
  producer.on('ready', () => {
    debug('on ready');
  });

  producer.on('error', (err) => {
    debug('on error', err);
  });
  return producer;
};

const TOPIC = process.env.TOPIC || 'SCRYPTO_TRANSACTIONS';
const PARTITION = process.env.PARTITION || 0;

module.exports = { create, TOPIC, PARTITION };
