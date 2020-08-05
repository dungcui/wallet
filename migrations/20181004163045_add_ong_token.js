
exports.up = async function up(knex) {
  await knex('tokens').insert({
    service: 'ONTOLOGY',
    currency: 'ONG',
    address: '0200000000000000000000000000000000000000',
    enabled: true,
  });
};

exports.down = async function down(knex) {
  await knex('tokens')
    .where({
      service: 'ONTOLOGY',
      currency: 'ONG',
    })
    .limit(1) // Insert 1 therefore delete only 1
    .del();
};
