exports.up = async function up(knex) {
    await knex.schema.createTable('limits', (t) => {
      t.increments('id').primary();
      t.string('service', 64).notNullable();
      t.text('walletId').notNullable();
      t.integer('limits').notNullable();
      t.dateTime('createdAt').defaultTo(knex.fn.now());
      t.dateTime('updatedAt');
    });
  };
  
  exports.down = async function down(knex) {
    await knex.schema.dropTable('limits');
  };