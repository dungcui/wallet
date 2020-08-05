
exports.up = async (knex) => {
  await knex.schema.createTable('tron_blocks', (t) => {
    t.increments('id').primary();
    t.string('hash', 64).unique();
    t.integer('height').unsigned().notNullable();
    t.dateTime('createdAt').defaultTo(knex.fn.now());
    t.dateTime('updatedAt');

    t.index('height');
  });

  await knex.schema.createTable('tron_wallets', (t) => {
    t.increments('id').primary();
    t.text('xpub').notNullable();
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('tron_addresses', (t) => {
    t.increments('id').primary();
    t.string('hash', 64).unique().notNullable();
    t.string('path', 255);
    // user - settlement
    t.string('type', 255).notNullable().defaultTo('user');
    t.integer('walletId').notNullable().references('id').inTable('tron_wallets');
    t.dateTime('createdAt').defaultTo(knex.fn.now());

    t.index('type');
    t.index('path');
    t.index('walletId');
  });

  await knex.schema.createTable('tron_transactions', (t) => {
    t.increments('id').primary();
    t.string('hash', 64).unique().notNullable();
    t.integer('walletId').notNullable().references('id').inTable('tron_wallets');
    t.integer('bundleId');
    t.string('state', 255);
    t.bigInteger('grossAmount');
    t.string('fromAddress', 64);
    t.string('fromPath', 255);
    t.string('toAddress', 64);
    t.string('toPath', 255);
    t.integer('blockHeight');
    t.string('type', 255);
    t.string('moveFundAtTransactionHash', 64);
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTable('tron_addresses');
  await knex.schema.dropTable('tron_blocks');
  await knex.schema.dropTable('tron_transactions');
  await knex.schema.dropTable('tron_wallets');
};
