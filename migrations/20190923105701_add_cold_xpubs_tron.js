exports.up = async function up(knex) {
    await knex.schema.alterTable('tron_wallets', (t) => {
      t.text('xpubsColdWallets').nullable();
    });
  };
exports.down = async function down(knex) {
    await knex.schema.table('tron_wallets', (t) => {
      t.dropColumn('xpubsColdWallets');
    });
  };