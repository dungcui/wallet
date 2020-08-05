exports.up = async function up(knex) {
  await knex.schema.alterTable('btc_tx_outs', (t) => {
    t.integer('spentAtBlockHeight');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('btc_tx_outs', (t) => {
    t.dropColumn('spentAtBlockHeight');
  });
};
