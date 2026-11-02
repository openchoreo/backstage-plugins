// @ts-check

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('dynamic_checks', table => {
    table.comment(
      'UI-managed tech-insights checks, replacing app-config.yaml-defined checks.',
    );
    table.string('id').notNullable().primary();
    table.string('type').notNullable();
    table.string('name').notNullable();
    table.text('description').nullable();
    table
      .text('fact_ids')
      .notNullable()
      .comment('JSON array of fact retriever ids');
    table
      .text('metadata')
      .nullable()
      .comment('JSON object: category, rank, etc.');
    table
      .text('filter')
      .nullable()
      .comment('JSON entity filter for this check');
    table.text('rule').notNullable().comment('JSON: { conditions, priority? }');
    table
      .string('status')
      .notNullable()
      .defaultTo('draft')
      .comment('draft | published');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTable('dynamic_checks');
};
