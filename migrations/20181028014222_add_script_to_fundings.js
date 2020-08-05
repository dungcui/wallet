exports.up = async function up(knex) {
  await knex.schema.table('fundings', (t) => {
    t.text('script').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.table('fundings', (t) => {
    t.dropColumn('script');
  });
};
