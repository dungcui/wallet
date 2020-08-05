#!/bin/node
const amqp = require('amqplib');
const debug = require('debug')('wallet:setup-mq');

async function main() {
  const mq = await amqp.connect(process.env.AMQP_URL);
  const channel = await mq.createChannel();
  const exName = process.env.BLOCKS_QUEUE_EXCHANGE;

  debug(`About to create exchange: ${exName}`);
  await channel.assertExchange(exName, 'fanout', { durable: true });

  debug('About to create queues: liquid, blocks');
  const liquid = await channel.assertQueue('liquid', { durable: true });
  const qryptos = await channel.assertQueue('blocks', { durable: true });

  debug('About to bind queues to exchange');
  await channel.bindQueue(liquid.queue, exName, '');
  await channel.bindQueue(qryptos.queue, exName, '');

  debug('Done');
  setTimeout(process.exit, 3000);
}

main().catch(debug);
