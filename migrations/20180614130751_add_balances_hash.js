exports.up = async function up(knex) {
  await knex.schema.createTable('balances_hash', (t) => {
    t.increments('id').primary();
    t.string('serviceName', 64).notNullable();
    t.text('content').notNullable();
    t.dateTime('createdAt').defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('balances_hash');
};
