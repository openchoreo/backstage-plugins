/*
 * Copyright 2024 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check

/**
 * Database migration to expand the last_error field from VARCHAR(255) to TEXT.
 * This allows storing full error stack traces and detailed error messages
 * without truncation.
 */

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('ingestions', table => {
    // Change last_error from VARCHAR(255) to TEXT to accommodate long error messages
    table.text('last_error').alter();
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('ingestions', table => {
    // Revert back to VARCHAR(255)
    // Note: This may truncate existing error messages longer than 255 characters
    table.string('last_error', 255).alter();
  });
};
