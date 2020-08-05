const _ = require('lodash');
const debug = require('debug');
const { create: createContainer, provision: provisionContainer } = require('../src/container');
const { create: createWorker } = require('../src/app/worker');
// const { create: createChannel } = require('../src/app/channel');

const log = {
  info: debug('wallet:app'),
  error: debug('wallet:app:error'),
};

async function setup() {
  // monitorName is the first service name
  const [monitorName] = process.env.SERVICE_NAMES.toUpperCase().split(',');
  if (!monitorName) throw Error('Please provide worker name');

  // Then provision env
  const container = provisionContainer(createContainer(), [monitorName]);

  // Load worker
  const monitor = container.resolve(_.camelCase(`${monitorName}_MONITOR`));
  monitor.name = monitorName;

  // Load mq channel & balancesHash db
  const channel = await createChannel({ container });
  const balancesHash = container.resolve('balancesHash');

  // Then listen & start
  const worker = createWorker({ monitor, channel, balancesHash });
  log.info('MQ is listening to block service');

  return { worker, channel };
}

async function main() {
  const { worker, channel } = await setup();
  const height = process.argv[2];
  await worker.processBlock({ height });
  channel.close();
  process.exit(0);
}

main().catch((err) => {
  log.error(err);
  process.exit();
});
