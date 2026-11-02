// @ts-check

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('dynamic_checks', table => {
    table
      .text('links')
      .nullable()
      .comment('JSON array of { title, url } reference links');
    table
      .text('success_metadata')
      .nullable()
      .comment('JSON object merged into metadata when the check passes');
    table
      .text('failure_metadata')
      .nullable()
      .comment('JSON object merged into metadata when the check fails');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('dynamic_checks', table => {
    table.dropColumn('links');
    table.dropColumn('success_metadata');
    table.dropColumn('failure_metadata');
  });
};
