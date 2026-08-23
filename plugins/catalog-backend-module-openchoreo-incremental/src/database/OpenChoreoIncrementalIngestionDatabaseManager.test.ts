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
 * Test suite for OpenChoreoIncrementalIngestionDatabaseManager.
 * Verifies database operations for incremental ingestion, including mark
 * storage and retrieval, cascading deletes, error truncation, and migration
 * idempotence. Runs against the real migrations directory.
 */
import { TestDatabases, mockServices } from '@backstage/backend-test-utils';
import type { SchedulerService } from '@backstage/backend-plugin-api';
import type { Entity } from '@backstage/catalog-model';
import type { EntityProviderConnection } from '@backstage/plugin-catalog-node';
import type { EventsService } from '@backstage/plugin-events-node';
import { v4 as uuid } from 'uuid';
import { WrapperProviders } from '../module/WrapperProviders';
import type {
  IncrementalEntityProvider,
  IncrementalEntityProviderOptions,
} from '../types';
import { OpenChoreoIncrementalIngestionDatabaseManager } from './OpenChoreoIncrementalIngestionDatabaseManager';
import { applyDatabaseMigrations } from './migrations';
import { DB_MIGRATIONS_TABLE } from './tables';

const migrationsDir = `${__dirname}/../../migrations`;

jest.setTimeout(60_000);

const EXPECTED_MIGRATION_NAMES = [
  '20221116073152_init.js',
  '20240110000001_add_performance_indexes.js',
  '20240110000003_expand_last_error_field.js',
];

function makeEntity(name: string): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { namespace: 'default', name },
  };
}

describe('OpenChoreoIncrementalIngestionDatabaseManager', () => {
  // SQLITE_3 runs everywhere with no docker dependency; the PostgreSQL
  // variants of the migration are exercised in deployment environments.
  const databases = TestDatabases.create({
    ids: ['SQLITE_3'],
  });

  it.each(databases.eachSupportedId())(
    'creates and returns the current ingestion record, %p',
    async databaseId => {
      const knex = await databases.init(databaseId);
      await applyDatabaseMigrations(knex);

      const manager = new OpenChoreoIncrementalIngestionDatabaseManager({
        client: knex,
        logger: mockServices.logger.mock(),
      });

      const created = await manager.createProviderIngestionRecord('myProvider');
      expect(created).toBeDefined();

      const record = await manager.getCurrentIngestionRecord('myProvider');
      expect(record).toBeDefined();
      expect(record!.id).toEqual(created!.ingestionId);
      expect(record!.provider_name).toEqual('myProvider');
      expect(record!.status).toEqual('bursting');
      expect(record!.completion_ticket).toEqual('open');

      // Completing the record closes the ticket: it is no longer current,
      // but remains retrievable as the previous record.
      await manager.setProviderComplete(created!.ingestionId);

      await expect(
        manager.getCurrentIngestionRecord('myProvider'),
      ).resolves.toBeUndefined();

      const previous = await manager.getPreviousIngestionRecord('myProvider');
      expect(previous).toBeDefined();
      expect(previous!.id).toEqual(created!.ingestionId);
      expect(previous!.completion_ticket).not.toEqual('open');
    },
  );

  it.each(databases.eachSupportedId())(
    'cascades mark entity deletion when the ingestion is deleted, %p',
    async databaseId => {
      const knex = await databases.init(databaseId);
      await applyDatabaseMigrations(knex);

      const manager = new OpenChoreoIncrementalIngestionDatabaseManager({
        client: knex,
        logger: mockServices.logger.mock(),
      });

      const { ingestionId } = (await manager.createProviderIngestionRecord(
        'myProvider',
      ))!;

      const markId = uuid();
      await manager.createMark({
        record: {
          id: markId,
          ingestion_id: ingestionId,
          sequence: 1,
          cursor: { data: 1 },
        },
      });
      await manager.createMarkEntities(markId, [
        { entity: makeEntity('one') },
        { entity: makeEntity('two') },
      ]);

      await expect(
        knex('ingestion_mark_entities').where({ ingestion_mark_id: markId }),
      ).resolves.toHaveLength(2);

      // Deleting the ingestion row must cascade through marks to entities.
      await knex('ingestions').where({ id: ingestionId }).delete();

      await expect(
        knex('ingestion_marks').where({ ingestion_id: ingestionId }),
      ).resolves.toHaveLength(0);
      await expect(
        knex('ingestion_mark_entities').where({ ingestion_mark_id: markId }),
      ).resolves.toHaveLength(0);
    },
  );

  it.each(databases.eachSupportedId())(
    'stores long last_error values on the expanded column and truncates at the storage limit, %p',
    async databaseId => {
      const knex = await databases.init(databaseId);
      await applyDatabaseMigrations(knex);

      const manager = new OpenChoreoIncrementalIngestionDatabaseManager({
        client: knex,
        logger: mockServices.logger.mock(),
      });

      const { ingestionId } = (await manager.createProviderIngestionRecord(
        'myProvider',
      ))!;

      // The expand migration turned last_error into a TEXT column, so a long
      // raw write round-trips without loss.
      await knex('ingestions')
        .where({ id: ingestionId })
        .update({ last_error: 'x'.repeat(10_000) });
      const rawRow = await knex('ingestions')
        .where({ id: ingestionId })
        .first();
      expect(rawRow.last_error.length).toEqual(10_000);

      // The manager itself truncates error text at its 2000-char limit.
      await manager.setProviderBackoff(
        ingestionId,
        0,
        new Error('y'.repeat(5_000)),
        1_000,
      );

      const row = await knex('ingestions').where({ id: ingestionId }).first();
      expect(row.last_error.length).toBeLessThanOrEqual(2_000);
      expect(row.last_error).toEqual(
        `Error: ${'y'.repeat(1_943)}... [error truncated]`,
      );
      expect(row.status).toEqual('backing off');
    },
  );

  it.each(databases.eachSupportedId())(
    'round-trips mark cursors so ingestion can resume, %p',
    async databaseId => {
      const knex = await databases.init(databaseId);
      await applyDatabaseMigrations(knex);

      const manager = new OpenChoreoIncrementalIngestionDatabaseManager({
        client: knex,
        logger: mockServices.logger.mock(),
      });

      const { ingestionId } = (await manager.createProviderIngestionRecord(
        'myProvider',
      ))!;

      await manager.createMark({
        record: {
          id: uuid(),
          ingestion_id: ingestionId,
          sequence: 1,
          cursor: { data: 1 },
        },
      });
      await manager.createMark({
        record: {
          id: uuid(),
          ingestion_id: ingestionId,
          sequence: 2,
          cursor: { data: 2, nextPage: 'cursor-2' },
        },
      });

      await expect(manager.getFirstMark(ingestionId)).resolves.toMatchObject({
        sequence: 1,
        cursor: { data: 1 },
      });
      await expect(manager.getLastMark(ingestionId)).resolves.toMatchObject({
        sequence: 2,
        cursor: { data: 2, nextPage: 'cursor-2' },
      });

      const marks = await manager.getAllMarks(ingestionId);
      expect(marks).toHaveLength(2);
      expect(marks.map((m: any) => m.sequence)).toEqual([2, 1]);
    },
  );

  it.each(databases.eachSupportedId())(
    'applies migrations idempotently and records each migration exactly once, %p',
    async databaseId => {
      const knex = await databases.init(databaseId);

      // Running the real migrations directory twice must be safe and must
      // not record duplicate entries.
      await applyDatabaseMigrations(knex);
      await applyDatabaseMigrations(knex);

      const names = (await knex(DB_MIGRATIONS_TABLE).select('name')).map(
        (row: { name: string }) => row.name,
      );
      expect(names.sort()).toEqual(EXPECTED_MIGRATION_NAMES);
      expect(new Set(names).size).toEqual(names.length);

      // The performance index migration's SQLite branch must have run.
      const indexes = (
        await knex.raw(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'",
        )
      ).map((row: { name: string }) => row.name);
      expect(indexes.sort()).toEqual([
        'idx_ingestion_mark_entities_composite',
        'idx_ingestion_mark_entities_ref',
        'idx_ingestion_marks_ingestion_id',
        'idx_ingestions_completion_ticket',
        'idx_ingestions_provider_name',
      ]);
    },
  );

  it.each(databases.eachSupportedId())(
    'runs migrations exactly once across concurrent WrapperProviders connects, %p',
    async databaseId => {
      const knex = await databases.init(databaseId);

      let applierCalls = 0;
      const countingApplier: typeof applyDatabaseMigrations = async client => {
        applierCalls += 1;
        await applyDatabaseMigrations(client);
      };

      const makeWrapper = () =>
        new WrapperProviders({
          config: mockServices.rootConfig.mock(),
          logger: mockServices.logger.mock(),
          client: knex,
          scheduler: {
            scheduleTask: jest.fn(),
          } as unknown as SchedulerService,
          applyDatabaseMigrations: countingApplier,
          events: {
            subscribe: jest.fn(),
          } as unknown as EventsService,
        });

      const connection: EntityProviderConnection = {
        applyMutation: jest.fn(),
        refresh: jest.fn(),
      };

      const makeProvider = (
        name: string,
      ): IncrementalEntityProvider<unknown, unknown> => ({
        getProviderName: () => name,
        next: async () => ({ done: true }),
        around: async burst => {
          await burst(undefined);
        },
      });

      const providerOptions: IncrementalEntityProviderOptions = {
        burstInterval: { seconds: 30 },
        burstLength: { seconds: 30 },
        restLength: { seconds: 30 },
      };

      // Two separate wrapper instances sharing one database client connect
      // concurrently; both must await the same single migration run.
      await Promise.all([
        makeWrapper()
          .wrap(makeProvider('provider-a'), providerOptions)
          .connect(connection),
        makeWrapper()
          .wrap(makeProvider('provider-b'), providerOptions)
          .connect(connection),
      ]);

      expect(applierCalls).toEqual(1);

      const names = (await knex(DB_MIGRATIONS_TABLE).select('name')).map(
        (row: { name: string }) => row.name,
      );
      expect(names.sort()).toEqual(EXPECTED_MIGRATION_NAMES);
    },
  );

  it.each(databases.eachSupportedId())(
    'rolls back all migrations cleanly, %p',
    async databaseId => {
      const knex = await databases.init(databaseId);
      await applyDatabaseMigrations(knex);

      const [, rolledBack] = await knex.migrate.rollback({
        directory: migrationsDir,
        tableName: DB_MIGRATIONS_TABLE,
      });
      expect(rolledBack).toHaveLength(3);

      await expect(
        knex(DB_MIGRATIONS_TABLE).select('name'),
      ).resolves.toHaveLength(0);
    },
  );
});
