exports.up = async function up(knex) {
  await knex.schema.createTable('btc_blocks', (t) => {
    t.increments('id').primary();
    t.string('hash', 64).unique().notNullable();
    t.integer('height').unsigned().notNullable();
    t.dateTime('createdAt').defaultTo(knex.fn.now());
    t.index('height');
  });

  await knex.schema.createTable('btc_wallets', (t) => {
    t.increments('id').primary();
    t.text('xpubs').notNullable();
    t.integer('minimum').unsigned().notNullable();
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('btc_addresses', (t) => {
    t.increments('id').primary();
    t.string('hash', 64).unique().notNullable();
    // TODO: Is path + wallet id unique
    t.text('path');
    // 0 - Normal, 1 - Change, -1 - Fee, -2 - Other exclude
    t.integer('type').notNullable().defaultTo(0);
    t.integer('walletId').notNullable().references('id').inTable('btc_wallets');
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('btc_tx_outs', (t) => {
    t.increments('id').primary();
    t.integer('blockHeight').notNullable();
    t.string('txHash', 64).notNullable();
    t.integer('index').notNullable();
    // Save satoshi
    t.bigInteger('amount').notNullable();
    t.integer('addressId').notNullable().references('id').inTable('btc_addresses');
    t.integer('walletId').notNullable().references('id').inTable('btc_wallets');
    t.text('script').notNullable();
    t.string('spentTxHash', 64);
    // 0 - pending, 1 - unspent, -1 - spent
    t.integer('status').notNullable().defaultTo(0);

    t.dateTime('createdAt').defaultTo(knex.fn.now());
    // t.dateTime('unspentAt');
    t.dateTime('spentAt');

    t.index('status');
    t.index(['txHash', 'index']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('btc_tx_outs');
  await knex.schema.dropTable('btc_addresses');
  await knex.schema.dropTable('btc_wallets');
  await knex.schema.dropTable('btc_blocks');
};
