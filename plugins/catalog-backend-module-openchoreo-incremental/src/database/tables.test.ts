/*
 * Copyright 2023 The Backstage Authors
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

/**
 * Test suite for the database table contracts.
 * Cross-checks every table and column declared by src/database/tables.ts
 * against the CREATE TABLE / ALTER TABLE SQL in the migrations, and verifies
 * that the database manager only references tables that the migrations
 * actually create.
 */
import { readFileSync } from 'fs';
import * as path from 'path';
import {
  DB_MIGRATIONS_TABLE,
  IngestionRecord,
  IngestionUpsert,
  MarkRecord,
  MarkRecordInsert,
} from './tables';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');
const initMigration = readFileSync(
  path.join(MIGRATIONS_DIR, '20221116073152_init.js'),
  'utf8',
);
const expandMigration = readFileSync(
  path.join(MIGRATIONS_DIR, '20240110000003_expand_last_error_field.js'),
  'utf8',
);
const migrationsSource = readFileSync(
  path.resolve(__dirname, 'migrations.ts'),
  'utf8',
);
const managerSource = readFileSync(
  path.resolve(__dirname, 'OpenChoreoIncrementalIngestionDatabaseManager.ts'),
  'utf8',
);

const MIGRATION_TABLES = [
  'ingestions',
  'ingestion_marks',
  'ingestion_mark_entities',
];

/**
 * Extracts the source block of one `createTable('name', ...)` call, ending
 * at the next top-level `knex.schema` statement.
 */
function extractCreateTableBlock(source: string, tableName: string): string {
  const start = source.indexOf(`createTable('${tableName}'`);
  if (start === -1) {
    throw new Error(`No createTable call found for '${tableName}'`);
  }
  const end = source.indexOf('await knex.schema', start + 1);
  return source.slice(start, end === -1 ? undefined : end);
}

/** Matches knex column builders like `.uuid('id')` or `.string('ref')`. */
const COLUMN_REGEX =
  /\.(?:uuid|string|integer|biginteger|timestamp|json|jsonb|text|boolean|float|double|date|datetime)\(\s*'([^']+)'/g;

function parseColumns(block: string): string[] {
  return Array.from(block.matchAll(COLUMN_REGEX), match => match[1]);
}

function sorted(values: string[]): string[] {
  return [...values].sort();
}

describe('database tables', () => {
  it('reserves a dedicated migrations table name', () => {
    expect(DB_MIGRATIONS_TABLE).toBe('incremental_ingestion__knex_migrations');
    // The migrations bookkeeping table must not collide with any of the
    // ingestion data tables.
    expect(MIGRATION_TABLES).not.toContain(DB_MIGRATIONS_TABLE);
  });

  it('creates exactly the three ingestion tables in the init migration', () => {
    const created = Array.from(
      initMigration.matchAll(/createTable\('([^']+)'/g),
      match => match[1],
    );
    expect(sorted(created)).toEqual(sorted(MIGRATION_TABLES));
  });

  it.each(MIGRATION_TABLES)(
    'declares columns in the init migration for %s',
    tableName => {
      // Every column referenced by the migration is well-formed and unique.
      const columns = parseColumns(
        extractCreateTableBlock(initMigration, tableName),
      );
      expect(new Set(columns).size).toEqual(columns.length);
    },
  );

  it('matches the ingestions columns against the IngestionRecord contract', () => {
    const columns = parseColumns(
      extractCreateTableBlock(initMigration, 'ingestions'),
    );
    expect(sorted(columns)).toEqual([
      'attempts',
      'completion_ticket',
      'created_at',
      'id',
      'ingestion_completed_at',
      'last_error',
      'next_action',
      'next_action_at',
      'provider_name',
      'rest_completed_at',
      'status',
    ]);

    // The IngestionRecord interface must expose exactly those columns.
    // Constructing a fully populated record and reflecting on its keys
    // fails to compile whenever the interface and the expectation diverge.
    const record: IngestionRecord = {
      id: 'some-id',
      provider_name: 'myProvider',
      status: 'bursting',
      next_action: 'ingest',
      next_action_at: new Date(),
      last_error: null,
      attempts: 0,
      created_at: '2023-01-01T00:00:00.000Z',
      ingestion_completed_at: null,
      rest_completed_at: null,
      completion_ticket: 'open',
    };
    expect(sorted(Object.keys(record))).toEqual(sorted(columns));

    // IngestionUpsert covers the writable subset (everything but the
    // generated created_at column).
    const upsert: IngestionUpsert = {
      id: record.id,
      provider_name: record.provider_name,
      status: record.status,
      next_action: record.next_action,
      next_action_at: record.next_action_at,
      last_error: record.last_error,
      attempts: record.attempts,
      ingestion_completed_at: record.ingestion_completed_at,
      rest_completed_at: record.rest_completed_at,
      completion_ticket: record.completion_ticket,
    };
    expect(sorted(Object.keys(upsert))).toEqual(
      sorted(columns.filter(column => column !== 'created_at')),
    );
  });

  it('matches the ingestion_marks columns against the MarkRecord contract', () => {
    const columns = parseColumns(
      extractCreateTableBlock(initMigration, 'ingestion_marks'),
    );
    expect(sorted(columns)).toEqual([
      'created_at',
      'cursor',
      'id',
      'ingestion_id',
      'sequence',
    ]);

    const record: MarkRecord = {
      id: 'some-id',
      ingestion_id: 'some-ingestion-id',
      sequence: 1,
      cursor: { page: 2 },
      created_at: '2023-01-01T00:00:00.000Z',
    };
    expect(sorted(Object.keys(record))).toEqual(sorted(columns));

    // Mark inserts carry the same data minus the generated created_at.
    const insert: MarkRecordInsert = {
      record: {
        id: record.id,
        ingestion_id: record.ingestion_id,
        sequence: record.sequence,
        cursor: record.cursor,
      },
    };
    expect(sorted(Object.keys(insert.record))).toEqual(
      sorted(columns.filter(column => column !== 'created_at')),
    );
  });

  it('matches the ingestion_mark_entities columns against its contract', () => {
    const columns = parseColumns(
      extractCreateTableBlock(initMigration, 'ingestion_mark_entities'),
    );
    expect(sorted(columns)).toEqual(['id', 'ingestion_mark_id', 'ref']);
  });

  it('expands only the last_error column of the ingestions table', () => {
    const upBlock = expandMigration.slice(
      expandMigration.indexOf('exports.up'),
      expandMigration.indexOf('exports.down'),
    );
    const altered = Array.from(
      upBlock.matchAll(/alterTable\('([^']+)'/g),
      match => match[1],
    );
    expect(altered).toEqual(['ingestions']);
    expect(expandMigration).not.toMatch(/createTable\(/);

    const alteredColumns = parseColumns(upBlock);
    expect(alteredColumns).toEqual(['last_error']);
    expect(upBlock).toMatch(/table\.text\('last_error'\)\.alter\(\)/);
  });

  it('has the migrations applier bookkeep under the reserved table', () => {
    expect(migrationsSource).toContain(
      "import { DB_MIGRATIONS_TABLE } from './tables'",
    );
    expect(migrationsSource).toContain('tableName: DB_MIGRATIONS_TABLE');
  });

  it('has the manager reference only tables declared by the migrations', () => {
    // Table references appear as tx('t'), tx<Type>('t'), join('t', ...) and
    // purgeTable('t') calls in the manager source.
    const referenced = new Set(
      Array.from(
        managerSource.matchAll(
          /(?:purgeTable|tx|join)(?:<[^>]*>)?\(\s*'([a-zA-Z_]+)'/g,
        ),
        match => match[1],
      ),
    );

    expect(sorted([...referenced])).toEqual(sorted(MIGRATION_TABLES));
    expect(referenced.has(DB_MIGRATIONS_TABLE)).toBe(false);
  });
});
