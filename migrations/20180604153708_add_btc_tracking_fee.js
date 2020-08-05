exports.up = async function up(knex) {
  await knex.schema.alterTable('btc_blocks', (t) => {
    t.bigInteger('fee');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('btc_blocks', (t) => {
    t.dropColumn('fee');
  });
};
