exports.up = async function up(knex) {
    await knex.schema.alterTable('wallets', (t) => {
      t.text('type').nullable();
    });
  };
exports.down = async function down(knex) {
    await knex.schema.table('wallets', (t) => {
      t.dropColumn('type');
    });
  };
  
  