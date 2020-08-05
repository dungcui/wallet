exports.up = async function up(knex) {
    await knex.schema.alterTable('tokens', (t) => {
      t.integer('decimals').nullable();
    });
  };
  exports.down = async function down(knex) {
    await knex.schema.table('tokens', (t) => {
      t.dropColumn('decimals');
    });
  };
  