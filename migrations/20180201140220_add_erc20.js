exports.up = async function up(knex) {
  await knex.schema.createTable('erc20_blocks', (t) => {
    t.increments('id').primary();
    t.string('hash', 64).unique().notNullable();
    t.integer('height').unsigned().notNullable();
    t.dateTime('createdAt').defaultTo(knex.fn.now());
    t.index('height');
  });

  await knex.schema.createTable('erc20_wallets', (t) => {
    t.increments('id').primary();
    t.string('xpubs').notNullable();
    t.integer('minimum').unsigned().notNullable();
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('erc20_contracts', (t) => {
    t.increments('id').primary();
    t.string('address').notNullable();
    t.integer('decimals').unsigned().notNullable();
    t.string('currency').notNullable();
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });


  await knex.schema.createTable('erc20_addresses', (t) => {
    t.increments('id').primary();
    t.string('hash', 64).unique().notNullable();
    // TODO: Is path + wallet id unique
    t.text('path');
    // 0 - Normal, 1 - Change, -1 - Fee, -2 - Other exclude
    t.integer('type').notNullable().defaultTo(0);
    t.integer('walletId').notNullable().references('id').inTable('erc20_wallets');
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('erc20_addresses');
  await knex.schema.dropTable('erc20_wallets');
  await knex.schema.dropTable('erc20_blocks');
  await knex.schema.dropTable('erc20_contracts');
};
