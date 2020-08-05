
exports.up = function(knex, Promise) {
  return knex.schema.table('wallets', function(t) {
      t.text('xpubsColdWallets');
  });
};
exports.down = function(knex, Promise) {
  return knex.schema.table('wallets', function(t) {
      t.dropColumn('xpubsColdWallets');
  });
};



