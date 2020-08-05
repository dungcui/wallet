exports.up = async function up(knex) {
  await knex.schema.createTable('btc_bundles', (t) => {
    t.increments('id').primary();
    t.string('txHash', 64).unique().notNullable();
    t.text('content').notNullable();
    // -2 Ignored, -1 - Failed, 0 - Uploaded, 1 - Confirmed
    t.integer('status').notNullable();
    t.integer('confirmedBlockHeight');
    t.dateTime('confirmedAt');
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('btc_bundles');
};
