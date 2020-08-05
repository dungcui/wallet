exports.up = async function up(knex) {
    await knex.schema.alterTable('vet_wallets', (t) => {
      t.text('xpubsColdWallets').nullable();
    });
};
exports.down = async function down(knex) {
    await knex.schema.table('vet_wallets', (t) => {
      t.dropColumn('xpubsColdWallets');
    });
};