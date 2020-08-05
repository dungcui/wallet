exports.up = async function up(knex) {
  await knex.schema.alterTable('withdrawals', (t) => {
    t.text('externalId')
      .nullable()
      .alter();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('withdrawals', (t) => {
    t.integer('script')
      .unsigned()
      .alter();
  });
};
