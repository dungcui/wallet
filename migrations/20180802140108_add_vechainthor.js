exports.up = async (knex) => {
  await knex.schema.createTable('vet_blocks', (t) => {
    t.increments('id').primary();
    t.string('hash', 66).unique();
    t.integer('height').unique().unsigned().notNullable();
    t.dateTime('createdAt').defaultTo(knex.fn.now());
    t.dateTime('updatedAt');
    t.index('height');
  });

  await knex.schema.createTable('vet_wallets', (t) => {
    t.increments('id').primary();
    t.text('xpub').unique().notNullable();
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('vet_addresses', (t) => {
    t.increments('id').primary();
    t.string('hash', 42).unique().notNullable();
    t.string('path', 255).notNullable();
    // type = user|settlement
    t.string('type', 255).notNullable().defaultTo('user');
    t.integer('walletId').notNullable().references('id').inTable('vet_wallets');
    t.dateTime('createdAt').defaultTo(knex.fn.now());

    t.unique(['path', 'walletId']);
    t.index('walletId');
  });

  await knex.schema.createTable('vet_transactions', (t) => {
    t.increments('id').primary();
    t.string('hash', 66).notNullable();
    t.integer('clauseIndex').notNullable();
    t.integer('walletId').notNullable().references('id').inTable('vet_wallets');
    t.string('state', 255);
    t.decimal('grossAmount', 96).notNullable();
    t.string('currency', 255).notNullable();
    t.string('fromAddress', 42);
    t.string('fromPath', 255);
    t.integer('fromAddressId').references('id').inTable('vet_addresses');
    t.string('toPath', 255);
    t.string('toAddress', 42);
    t.integer('toAddressId').references('id').inTable('vet_addresses');
    t.integer('blockHeight');
    t.string('type', 255);
    t.string('moveFundAtTxHash', 66);
    t.dateTime('createdAt').defaultTo(knex.fn.now());
    t.dateTime('updatedAt').defaultTo(knex.fn.now());
    t.index('walletId');
    t.index('type');

    t.unique(['hash', 'clauseIndex']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTable('vet_transactions');
  await knex.schema.dropTable('vet_blocks');
  await knex.schema.dropTable('vet_addresses');
  await knex.schema.dropTable('vet_wallets');
};
