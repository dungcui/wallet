exports.up = async function up(knex) {
  await knex.schema.createTable('wallets', (t) => {
    t.increments('id').primary();
    t.string('service', 64).notNullable();
    t.text('xpubs');
    t.integer('minimum').unsigned();
    t.string('settlementAddress', 255);
    t.dateTime('createdAt').defaultTo(knex.fn.now());

    t.index('service');
    t.index('settlementAddress');
  });

  await knex.schema.createTable('addresses', (t) => {
    t.increments('id').primary();
    t.string('service', 64).notNullable();
    t.string('address', 255).notNullable();
    t.string('memo', 255);
    t.string('path', 255).notNullable();
    t.string('type', 255).notNullable();
    t.integer('walletId').notNullable().references('id').inTable('wallets');
    t.dateTime('createdAt').defaultTo(knex.fn.now());

    t.index('service');
    t.index('path');
    t.index('type');
    t.index('address');
    t.index('memo');
    t.index('walletId');
  });

  await knex.schema.createTable('blocks', (t) => {
    t.string('service', 64).unique().notNullable();
    t.integer('height').unsigned().notNullable();
    t.dateTime('createdAt').defaultTo(knex.fn.now());
    t.dateTime('updatedAt');
  });

  await knex.schema.createTable('fundings', (t) => {
    t.increments('id').primary();
    t.string('service', 64).notNullable();
    t.string('transactionHash', 255).notNullable();
    t.integer('outputIndex').unsigned().notNullable().defaultTo(0);
    t.string('type', 255).notNullable();
    t.integer('blockHeight').unsigned().notNullable();
    t.decimal('amount', 100, 20).notNullable();
    t.string('currency', 255).notNullable();
    t.integer('addressId').notNullable().references('id').inTable('addresses');
    t.string('spentInTransactionHash', 255);
    t.string('state', 255).notNullable();
    t.dateTime('createdAt').defaultTo(knex.fn.now());
    t.dateTime('updatedAt');

    t.index('service');
    t.index('type');
    t.index('transactionHash');
    t.index('outputIndex');
    t.index('blockHeight');
    t.index('addressId');
    t.index('spentInTransactionHash');
    t.index('state');
    t.index('currency');
  });

  await knex.schema.createTable('withdrawals', (t) => {
    t.increments('id').primary();
    t.string('service', 64).notNullable();
    t.string('toAddress').notNullable();
    t.string('transactionHash', 255).notNullable();
    t.integer('outputIndex').unsigned().notNullable().defaultTo(0);
    t.decimal('amount', 100, 20).notNullable();
    t.string('currency', 255).notNullable();
    t.integer('externalId').unsigned();
    t.string('state', 255).notNullable();
    t.dateTime('createdAt').defaultTo(knex.fn.now());
    t.dateTime('updatedAt');

    t.index('service');
    t.index('transactionHash');
    t.index('outputIndex');
    t.index('toAddress');
    t.index('state');
    t.index('currency');
  });

  await knex.schema.createTable('tokens', (t) => {
    t.increments('id').primary();
    t.string('service', 64).notNullable();
    t.string('currency', 255).notNullable();
    t.string('address', 255).notNullable();
    t.boolean('enabled').notNullable().defaultTo(false);
    t.dateTime('createdAt').defaultTo(knex.fn.now());
    t.dateTime('updatedAt');

    t.index('service');
    t.index('currency');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('tokens');
  await knex.schema.dropTable('withdrawals');
  await knex.schema.dropTable('fundings');
  await knex.schema.dropTable('addresses');
  await knex.schema.dropTable('wallets');
  await knex.schema.dropTable('blocks');
};
