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

// Provenance: adapted from the OpenChoreo incremental ingestion module of
// https://github.com/openchoreo/backstage-plugins, Apache-2.0. All statements
// targeting the catalog backend's own tables were dropped: this module only
// manages the `ingestions`, `ingestion_marks`, and
// `ingestion_mark_entities` tables it creates itself.

// @ts-check

/**
 * Performance optimization migration for OpenChoreo incremental ingestion
 * This migration adds database indexes to improve query performance for large datasets
 *
 * Expected performance improvements:
 * - 50-70% faster ingestion time
 * - 5-10x faster database queries
 * - Reduced memory pressure during large ingestions
 */

// Disable transactions for this migration due to CREATE INDEX CONCURRENTLY commands
// PostgreSQL CONCURRENTLY operations cannot run inside transaction blocks
exports.config = { transaction: false };

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function up(knex) {
  const isPostgres = knex.client.config.client === 'pg';

  if (isPostgres) {
    console.log('Applying PostgreSQL performance indexes...');

    // Create indexes concurrently to avoid blocking production traffic
    await knex.raw(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingestion_mark_entities_ref
      ON ingestion_mark_entities(ref);
    `);

    await knex.raw(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingestion_marks_ingestion_id
      ON ingestion_marks(ingestion_id);
    `);

    await knex.raw(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingestions_provider_name
      ON ingestions(provider_name);
    `);

    await knex.raw(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingestions_completion_ticket
      ON ingestions(completion_ticket);
    `);

    await knex.raw(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingestion_mark_entities_composite
      ON ingestion_mark_entities(ingestion_mark_id, ref);
    `);

    // Update table statistics for query optimizer
    await knex.raw('ANALYZE ingestion_mark_entities');
    await knex.raw('ANALYZE ingestion_marks');
    await knex.raw('ANALYZE ingestions');

    // Create performance monitoring view
    await knex.raw(`
      CREATE OR REPLACE VIEW ingestion_performance_stats AS
      SELECT
          i.provider_name,
          COUNT(DISTINCT ime.ref) as total_entities,
          COUNT(DISTINCT im.id) as total_marks,
          MAX(i.created_at) as last_ingestion_start,
          MAX(i.ingestion_completed_at) as last_ingestion_complete,
          CASE
              WHEN i.status = 'resting' THEN 'RESTING'
              WHEN i.status = 'bursting' THEN 'ACTIVE'
              WHEN i.status = 'backing off' THEN 'ERROR'
              ELSE 'UNKNOWN'
          END as current_status
      FROM ingestions i
      LEFT JOIN ingestion_marks im ON i.id = im.ingestion_id
      LEFT JOIN ingestion_mark_entities ime ON im.id = ime.ingestion_mark_id
      WHERE i.completion_ticket = 'open'
      GROUP BY i.provider_name, i.status
    `);

    console.log('PostgreSQL performance indexes created successfully');
  } else {
    // SQLite for development/testing
    console.log('Applying SQLite performance indexes...');

    await knex.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_ingestion_mark_entities_ref
      ON ingestion_mark_entities(ref);
    `);

    await knex.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_ingestion_marks_ingestion_id
      ON ingestion_marks(ingestion_id);
    `);

    await knex.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_ingestions_provider_name
      ON ingestions(provider_name);
    `);

    await knex.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_ingestions_completion_ticket
      ON ingestions(completion_ticket);
    `);

    await knex.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_ingestion_mark_entities_composite
      ON ingestion_mark_entities(ingestion_mark_id, ref);
    `);

    console.log('SQLite performance indexes created successfully');
  }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function down(knex) {
  const isPostgres = knex.client.config.client === 'pg';

  if (isPostgres) {
    console.log('Removing PostgreSQL performance indexes...');

    // Drop indexes concurrently
    await knex.raw(
      'DROP INDEX CONCURRENTLY IF EXISTS idx_ingestion_mark_entities_ref',
    );
    await knex.raw(
      'DROP INDEX CONCURRENTLY IF EXISTS idx_ingestion_marks_ingestion_id',
    );
    await knex.raw(
      'DROP INDEX CONCURRENTLY IF EXISTS idx_ingestions_provider_name',
    );
    await knex.raw(
      'DROP INDEX CONCURRENTLY IF EXISTS idx_ingestions_completion_ticket',
    );
    await knex.raw(
      'DROP INDEX CONCURRENTLY IF EXISTS idx_ingestion_mark_entities_composite',
    );

    // Drop monitoring view
    await knex.raw('DROP VIEW IF EXISTS ingestion_performance_stats');

    console.log('PostgreSQL performance indexes removed');
  } else {
    console.log('Removing SQLite performance indexes...');

    await knex.schema.raw(
      'DROP INDEX IF EXISTS idx_ingestion_mark_entities_ref',
    );
    await knex.schema.raw(
      'DROP INDEX IF EXISTS idx_ingestion_marks_ingestion_id',
    );
    await knex.schema.raw('DROP INDEX IF EXISTS idx_ingestions_provider_name');
    await knex.schema.raw(
      'DROP INDEX IF EXISTS idx_ingestions_completion_ticket',
    );
    await knex.schema.raw(
      'DROP INDEX IF EXISTS idx_ingestion_mark_entities_composite',
    );

    console.log('SQLite performance indexes removed');
  }
};
