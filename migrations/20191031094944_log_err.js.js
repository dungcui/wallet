exports.up = async function up(knex) {
    await knex.schema.createTable('log_errors', (t) => {
      t.increments('id').primary();
      t.string('service', 64).notNullable();
      t.text('err').notNullable();
      t.text('at').notNullable();
      t.dateTime('createdAt').defaultTo(knex.fn.now());
      t.dateTime('updatedAt');
    });
  };
  
  exports.down = async function down(knex) {
    await knex.schema.dropTable('log_errors');
  };