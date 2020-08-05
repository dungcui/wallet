exports.up = function(knex, Promise) {
    return knex.schema.table('wallets', function(t) {
        t.text('coldSettlementAddress');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.table('wallets', function(t) {
        t.dropColumn('coldSettlementAddress');
    });
};

