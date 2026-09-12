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
import {
  TestDatabases,
  mockServices,
  type TestDatabaseId,
} from '@backstage/backend-test-utils';
import type { SchedulerService } from '@backstage/backend-plugin-api';
import type { Entity } from '@backstage/catalog-model';
import type { EntityProviderConnection } from '@backstage/plugin-catalog-node';
import type { EventsService } from '@backstage/plugin-events-node';
import type { Knex } from 'knex';
import { Duration } from 'luxon';
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

/** Inserts a completed ingestion row through the manager's insert path. */
async function insertFinishedIngestion(
  manager: OpenChoreoIncrementalIngestionDatabaseManager,
  provider: string,
  options: { restCompletedAt: Date; completionTicket?: string },
): Promise<string> {
  const id = uuid();
  await manager.insertIngestionRecord({
    id,
    provider_name: provider,
    status: 'complete',
    next_action: 'nothing (done)',
    completion_ticket: options.completionTicket ?? uuid(),
    ingestion_completed_at: options.restCompletedAt,
    rest_completed_at: options.restCompletedAt,
  });
  return id;
}

/** Creates a mark and attaches raw entity refs to it in one go. */
async function addMarkWithRefs(
  knex: Knex,
  ingestionId: string,
  sequence: number,
  refs: string[],
): Promise<string> {
  const markId = uuid();
  await knex('ingestion_marks').insert({
    id: markId,
    ingestion_id: ingestionId,
    sequence,
    cursor: JSON.stringify({ sequence }),
  });
  if (refs.length > 0) {
    await knex('ingestion_mark_entities').insert(
      refs.map(ref => ({ id: uuid(), ingestion_mark_id: markId, ref })),
    );
  }
  return markId;
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

  // Shared setup for the suites below: a migrated SQLite database plus a
  // manager instance wired to a mock logger.
  async function setup(databaseId: TestDatabaseId) {
    const knex = await databases.init(databaseId);
    await applyDatabaseMigrations(knex);
    const manager = new OpenChoreoIncrementalIngestionDatabaseManager({
      client: knex,
      logger: mockServices.logger.mock(),
    });
    return { knex, manager };
  }

  describe('ingestion record updates', () => {
    it.each(databases.eachSupportedId())(
      'updates records by id and ignores unknown ids, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);
        const { ingestionId } = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;

        await manager.setProviderBursting(ingestionId);
        let row = await knex('ingestions').where({ id: ingestionId }).first();
        expect(row.status).toEqual('bursting');
        expect(row.next_action).toEqual('ingest');
        expect(row.attempts).toEqual(0);

        await manager.updateIngestionRecordById({
          ingestionId,
          update: { status: 'resting', next_action: 'rest' },
        });
        await manager.setProviderIngesting(ingestionId);
        row = await knex('ingestions').where({ id: ingestionId }).first();
        expect(row.status).toEqual('resting');
        expect(row.next_action).toEqual('ingest');

        // Updating a nonexistent id is a silent no-op.
        await expect(
          manager.updateIngestionRecordById({
            ingestionId: uuid(),
            update: { status: 'bursting' },
          }),
        ).resolves.toBeUndefined();
        row = await knex('ingestions').where({ id: ingestionId }).first();
        expect(row.status).toEqual('resting');
      },
    );

    it.each(databases.eachSupportedId())(
      'resets attempts when entering the interstitial state, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);
        const { ingestionId } = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;

        const before = Date.now();
        await manager.setProviderBackoff(
          ingestionId,
          2,
          new Error('source unavailable'),
          5_000,
        );
        let row = await knex('ingestions').where({ id: ingestionId }).first();
        expect(row.status).toEqual('backing off');
        expect(row.next_action).toEqual('backoff');
        expect(row.attempts).toEqual(3);
        expect(row.last_error).toContain('source unavailable');
        const backoffAt = new Date(row.next_action_at).getTime();
        expect(backoffAt).toBeGreaterThanOrEqual(before + 4_000);
        expect(backoffAt).toBeLessThanOrEqual(Date.now() + 6_000);

        await manager.setProviderInterstitial(ingestionId);
        row = await knex('ingestions').where({ id: ingestionId }).first();
        expect(row.status).toEqual('interstitial');
        expect(row.attempts).toEqual(0);
      },
    );

    it.each(databases.eachSupportedId())(
      'schedules the rest period when the burst completes, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);
        const { ingestionId } = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;

        const before = Date.now();
        await manager.setProviderResting(
          ingestionId,
          Duration.fromObject({ minutes: 30 }),
        );
        const row = await knex('ingestions').where({ id: ingestionId }).first();
        expect(row.next_action).toEqual('rest');
        expect(row.status).toEqual('resting');
        expect(row.ingestion_completed_at).toBeTruthy();
        const restAt = new Date(row.next_action_at).getTime();
        expect(restAt).toBeGreaterThanOrEqual(before + 29 * 60_000);
        expect(restAt).toBeLessThanOrEqual(Date.now() + 31 * 60_000);
      },
    );

    it.each(databases.eachSupportedId())(
      'records the cancel reason and completes the cancellation, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);
        const { ingestionId } = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;

        await manager.setProviderCanceling(ingestionId, 'stop requested');
        let row = await knex('ingestions').where({ id: ingestionId }).first();
        expect(row.next_action).toEqual('cancel');
        expect(row.status).toEqual('canceling');
        expect(row.last_error).toEqual('stop requested');
        expect(new Date(row.next_action_at).getTime()).toBeLessThanOrEqual(
          Date.now(),
        );

        await manager.setProviderCanceled(ingestionId);
        row = await knex('ingestions').where({ id: ingestionId }).first();
        expect(row.next_action).toEqual('nothing (canceled)');
        expect(row.status).toEqual('complete');
        expect(row.rest_completed_at).toBeTruthy();
        expect(row.completion_ticket).not.toEqual('open');

        await expect(
          manager.getCurrentIngestionRecord('myProvider'),
        ).resolves.toBeUndefined();
        await expect(
          manager.getPreviousIngestionRecord('myProvider'),
        ).resolves.toMatchObject({ id: ingestionId });
      },
    );

    it.each(databases.eachSupportedId())(
      'canceling without a message leaves last_error untouched, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);
        const { ingestionId } = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;

        await manager.setProviderCanceling(ingestionId);
        const row = await knex('ingestions').where({ id: ingestionId }).first();
        expect(row.status).toEqual('canceling');
        expect(row.next_action).toEqual('cancel');
        expect(row.last_error).toBeFalsy();
      },
    );

    it.each(databases.eachSupportedId())(
      'provider updates and triggered actions only affect open tickets, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);

        const { ingestionId } = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;
        const farFuture = new Date(Date.now() + 3_600_000);
        await knex('ingestions')
          .where({ id: ingestionId })
          .update({ next_action_at: farFuture });

        const finishedId = await insertFinishedIngestion(
          manager,
          'myProvider',
          { restCompletedAt: new Date(Date.now() - 60_000) },
        );
        await knex('ingestions')
          .where({ id: finishedId })
          .update({ next_action_at: farFuture });

        await manager.triggerNextProviderAction('myProvider');
        let openRow = await knex('ingestions')
          .where({ id: ingestionId })
          .first();
        let finishedRow = await knex('ingestions')
          .where({ id: finishedId })
          .first();
        expect(new Date(openRow.next_action_at).getTime()).toBeLessThanOrEqual(
          Date.now(),
        );
        expect(new Date(finishedRow.next_action_at).getTime()).toBeGreaterThan(
          Date.now() + 3_000_000,
        );

        await manager.updateByName('myProvider', { status: 'resting' });
        openRow = await knex('ingestions').where({ id: ingestionId }).first();
        finishedRow = await knex('ingestions')
          .where({ id: finishedId })
          .first();
        expect(openRow.status).toEqual('resting');
        expect(finishedRow.status).toEqual('complete');
      },
    );
  });

  describe('ingestion cleanup', () => {
    it.each(databases.eachSupportedId())(
      'returns undefined when the provider already has an open ingestion, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);
        const first = await manager.createProviderIngestionRecord('myProvider');

        // The (provider_name, completion_ticket) uniqueness rejects the
        // second open record, which the manager reports as undefined.
        await expect(
          manager.createProviderIngestionRecord('myProvider'),
        ).resolves.toBeUndefined();

        const record = await manager.getCurrentIngestionRecord('myProvider');
        expect(record!.id).toEqual(first!.ingestionId);
        await expect(knex('ingestions')).resolves.toHaveLength(1);
      },
    );

    it.each(databases.eachSupportedId())(
      'clears stale duplicate active ingestions but keeps fresh ones, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);
        const { ingestionId } = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;

        const staleId = uuid();
        await manager.insertIngestionRecord({
          id: staleId,
          provider_name: 'myProvider',
          status: 'bursting',
          next_action: 'ingest',
          completion_ticket: 'stale-ticket',
        });
        await knex('ingestions')
          .where({ id: staleId })
          .update({
            created_at: new Date(Date.now() - 2 * 3_600_000),
          });
        await addMarkWithRefs(knex, staleId, 1, [
          'component:default/stale-one',
          'component:default/stale-two',
        ]);

        const freshId = uuid();
        await manager.insertIngestionRecord({
          id: freshId,
          provider_name: 'myProvider',
          status: 'bursting',
          next_action: 'ingest',
          completion_ticket: 'fresh-ticket',
        });

        await manager.clearDuplicateIngestions(ingestionId, 'myProvider');

        const ids = (await knex('ingestions').select('id')).map(
          (row: { id: string }) => row.id,
        );
        expect(ids.sort()).toEqual([freshId, ingestionId].sort());
        await expect(
          knex('ingestion_marks').where({ ingestion_id: staleId }),
        ).resolves.toHaveLength(0);
        await expect(
          knex('ingestion_mark_entities').where({
            ref: 'component:default/stale-one',
          }),
        ).resolves.toHaveLength(0);
      },
    );

    it.each(databases.eachSupportedId())(
      'keeps the newest finished ingestion and the running one when clearing, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);

        const olderId = await insertFinishedIngestion(manager, 'myProvider', {
          restCompletedAt: new Date(Date.now() - 2 * 3_600_000),
        });
        await addMarkWithRefs(knex, olderId, 1, [
          'component:default/older-one',
          'component:default/older-two',
        ]);
        const newerId = await insertFinishedIngestion(manager, 'myProvider', {
          restCompletedAt: new Date(Date.now() - 3_600_000),
        });
        await addMarkWithRefs(knex, newerId, 1, [
          'component:default/newer-one',
        ]);
        const { ingestionId: runningId } =
          (await manager.createProviderIngestionRecord('myProvider'))!;

        const { deletions } = await manager.clearFinishedIngestions(
          'myProvider',
        );
        expect(deletions).toEqual({
          markEntitiesDeleted: 2,
          marksDeleted: 1,
          ingestionsDeleted: 1,
        });

        const ids = (await knex('ingestions').select('id')).map(
          (row: { id: string }) => row.id,
        );
        expect(ids.sort()).toEqual([newerId, runningId].sort());
        await expect(
          knex('ingestion_marks').where({ ingestion_id: olderId }),
        ).resolves.toHaveLength(0);
        await expect(
          knex('ingestion_marks').where({ ingestion_id: newerId }),
        ).resolves.toHaveLength(1);
        await expect(
          knex('ingestion_mark_entities').where({
            ref: 'component:default/newer-one',
          }),
        ).resolves.toHaveLength(1);

        await expect(
          manager.getPreviousIngestionRecord('myProvider'),
        ).resolves.toMatchObject({ id: newerId });
      },
    );

    it.each(databases.eachSupportedId())(
      'deletes nothing when only a running ingestion exists, %p',
      async databaseId => {
        const { manager } = await setup(databaseId);
        const { ingestionId } = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;

        const { deletions } = await manager.clearFinishedIngestions(
          'myProvider',
        );
        expect(deletions).toEqual({
          markEntitiesDeleted: 0,
          marksDeleted: 0,
          ingestionsDeleted: 0,
        });
        await expect(
          manager.getCurrentIngestionRecord('myProvider'),
        ).resolves.toMatchObject({ id: ingestionId });
      },
    );
  });

  describe('purge and reset', () => {
    it.each(databases.eachSupportedId())(
      'purges all provider data and leaves it resting, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);
        const { ingestionId } = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;

        const markId = uuid();
        await manager.createMark({
          record: {
            id: markId,
            ingestion_id: ingestionId,
            sequence: 1,
            cursor: { page: 1 },
          },
        });
        await manager.createMarkEntities(markId, [
          { entity: makeEntity('one') },
          { entity: makeEntity('two') },
          { entity: makeEntity('three') },
        ]);

        const result = await manager.purgeAndResetProvider('myProvider');
        expect(result).toMatchObject({
          provider: 'myProvider',
          ingestionsDeleted: 1,
          marksDeleted: 1,
          markEntitiesDeleted: 3,
        });

        await expect(knex('ingestion_marks')).resolves.toHaveLength(0);
        await expect(knex('ingestion_mark_entities')).resolves.toHaveLength(0);
        await expect(knex('ingestions')).resolves.toHaveLength(1);

        const reset = await manager.getCurrentIngestionRecord('myProvider');
        expect(reset).toMatchObject({
          provider_name: 'myProvider',
          status: 'resting',
          next_action: 'rest',
          completion_ticket: 'open',
        });
        const resetAt = new Date(reset!.next_action_at).getTime();
        expect(resetAt).toBeGreaterThan(Date.now() + 23 * 3_600_000);
        expect(resetAt).toBeLessThan(Date.now() + 25 * 3_600_000);
      },
    );

    it.each(databases.eachSupportedId())(
      'seeds a resting record for providers without history, %p',
      async databaseId => {
        const { manager } = await setup(databaseId);

        const result = await manager.purgeAndResetProvider('ghost');
        expect(result).toMatchObject({
          provider: 'ghost',
          ingestionsDeleted: 0,
          marksDeleted: 0,
          markEntitiesDeleted: 0,
        });
        await expect(
          manager.getCurrentIngestionRecord('ghost'),
        ).resolves.toMatchObject({ status: 'resting' });
      },
    );

    it.each(databases.eachSupportedId())(
      'cleans up every provider across all tables, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);

        for (const provider of ['provider-a', 'provider-b']) {
          const { ingestionId } = (await manager.createProviderIngestionRecord(
            provider,
          ))!;
          await addMarkWithRefs(knex, ingestionId, 1, [
            `component:default/${provider}-one`,
            `component:default/${provider}-two`,
          ]);
        }

        const result = await manager.cleanupProviders();
        expect(result).toEqual({
          ingestionsDeleted: 2,
          // The marks cascade away with their ingestions, so the explicit
          // mark purges find nothing left to remove.
          ingestionMarksDeleted: 0,
          markEntitiesDeleted: 0,
        });

        await expect(knex('ingestion_marks')).resolves.toHaveLength(0);
        await expect(knex('ingestion_mark_entities')).resolves.toHaveLength(0);

        for (const provider of ['provider-a', 'provider-b']) {
          await expect(
            knex('ingestions').where({ provider_name: provider }),
          ).resolves.toHaveLength(1);
          await expect(
            manager.getCurrentIngestionRecord(provider),
          ).resolves.toMatchObject({
            status: 'resting',
            next_action: 'rest',
            completion_ticket: 'open',
          });
        }
      },
    );
  });

  describe('mark-and-sweep bookkeeping', () => {
    it.each(databases.eachSupportedId())(
      'computes removed entities between consecutive ingestions, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);

        // First ingestion marks three entities, then completes.
        const first = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;
        const firstMark = uuid();
        await manager.createMark({
          record: {
            id: firstMark,
            ingestion_id: first.ingestionId,
            sequence: 1,
            cursor: { page: 1 },
          },
        });
        await manager.createMarkEntities(firstMark, [
          { entity: makeEntity('one') },
          { entity: makeEntity('two') },
          { entity: makeEntity('three') },
        ]);
        await manager.setProviderComplete(first.ingestionId);

        // Second ingestion re-marks only two of them.
        const second = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;
        const secondMark = uuid();
        await manager.createMark({
          record: {
            id: secondMark,
            ingestion_id: second.ingestionId,
            sequence: 1,
            cursor: { page: 1 },
          },
        });
        await manager.createMarkEntities(secondMark, [
          { entity: makeEntity('one') },
          { entity: makeEntity('two') },
        ]);

        const { total, removed } = await manager.computeRemoved(
          'myProvider',
          second.ingestionId,
        );
        expect(total).toEqual(2);
        expect(removed).toEqual([{ entityRef: 'component:default/three' }]);

        // The re-marked entities now belong to the newest mark only.
        await expect(
          knex('ingestion_mark_entities').where({
            ingestion_mark_id: secondMark,
          }),
        ).resolves.toHaveLength(2);
        await expect(
          knex('ingestion_mark_entities').where({
            ingestion_mark_id: firstMark,
          }),
        ).resolves.toHaveLength(1);
      },
    );

    it.each(databases.eachSupportedId())(
      'computes no removals without a previous ingestion, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);
        const { ingestionId } = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;

        const markId = uuid();
        await manager.createMark({
          record: {
            id: markId,
            ingestion_id: ingestionId,
            sequence: 1,
            cursor: { page: 1 },
          },
        });
        await knex('ingestion_mark_entities').insert(
          ['component:default/one', 'component:default/two'].map(ref => ({
            id: uuid(),
            ingestion_mark_id: markId,
            ref,
          })),
        );

        const { total, removed } = await manager.computeRemoved(
          'myProvider',
          ingestionId,
        );
        expect(total).toEqual(2);
        expect(removed).toEqual([]);
      },
    );

    it.each(databases.eachSupportedId())(
      'counts marked entities by kind and flags malformed refs, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);
        const { ingestionId } = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;

        const markId = uuid();
        await manager.createMark({
          record: {
            id: markId,
            ingestion_id: ingestionId,
            sequence: 1,
            cursor: { page: 1 },
          },
        });
        const refs = [
          'Component:default/one',
          'component:default/two',
          'api:default/three',
          'group:default/four',
          'missing-colon-ref',
          ':empty-kind',
        ];
        await knex('ingestion_mark_entities').insert(
          refs.map(ref => ({
            id: uuid(),
            ingestion_mark_id: markId,
            ref,
          })),
        );

        await expect(
          manager.getEntityCountsByKind(ingestionId),
        ).resolves.toEqual({
          total: 6,
          component: 2,
          api: 1,
          group: 1,
          invalid: 2,
        });
      },
    );

    it.each(databases.eachSupportedId())(
      'deletes entity records by ref, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);
        const { ingestionId } = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;

        await addMarkWithRefs(knex, ingestionId, 1, [
          'component:default/one',
          'component:default/two',
          'component:default/three',
        ]);

        await manager.deleteEntityRecordsByRef([
          { entityRef: 'component:default/one' },
          { entityRef: 'component:default/three' },
        ]);
        await expect(
          knex('ingestion_mark_entities').select('ref'),
        ).resolves.toEqual([{ ref: 'component:default/two' }]);

        // Empty input is a no-op.
        await expect(
          manager.deleteEntityRecordsByRef([]),
        ).resolves.toBeUndefined();
        await expect(
          knex('ingestion_mark_entities').select('ref'),
        ).resolves.toEqual([{ ref: 'component:default/two' }]);
      },
    );

    it.each(databases.eachSupportedId())(
      'healthchecks the active ingestion rows, %p',
      async databaseId => {
        const { manager } = await setup(databaseId);

        await manager.createProviderIngestionRecord('provider-a');
        await manager.createProviderIngestionRecord('provider-b');
        await insertFinishedIngestion(manager, 'provider-a', {
          restCompletedAt: new Date(Date.now() - 60_000),
        });

        const rows = await manager.healthcheck();
        expect(rows).toHaveLength(2);
        expect(
          rows
            .map((row: { provider_name: string }) => row.provider_name)
            .sort(),
        ).toEqual(['provider-a', 'provider-b']);
        for (const row of rows) {
          expect(row.id).toBeDefined();
        }
      },
    );
  });

  describe('failure handling', () => {
    it.each(databases.eachSupportedId())(
      'reports wrapped transaction errors when tables are missing, %p',
      async databaseId => {
        // No migrations are applied, so every statement fails and each
        // method must surface a wrapped transaction error.
        const knex = await databases.init(databaseId);
        const manager = new OpenChoreoIncrementalIngestionDatabaseManager({
          client: knex,
          logger: mockServices.logger.mock(),
        });

        // The failed insert makes record creation report undefined.
        await expect(
          manager.createProviderIngestionRecord('myProvider'),
        ).resolves.toBeUndefined();

        await expect(
          manager.updateIngestionRecordById({
            ingestionId: uuid(),
            update: { status: 'resting' },
          }),
        ).rejects.toThrow();
        await expect(
          manager.updateIngestionRecordByProvider('myProvider', {
            status: 'resting',
          }),
        ).rejects.toThrow();
        await expect(
          manager.insertIngestionRecord({
            provider_name: 'myProvider',
            status: 'bursting',
            next_action: 'ingest',
            completion_ticket: 'open',
          }),
        ).rejects.toThrow();
        await expect(
          manager.getCurrentIngestionRecord('myProvider'),
        ).rejects.toThrow();
        await expect(
          manager.getPreviousIngestionRecord('myProvider'),
        ).rejects.toThrow();
        await expect(
          manager.clearFinishedIngestions('myProvider'),
        ).rejects.toThrow();
        await expect(
          manager.clearDuplicateIngestions(uuid(), 'myProvider'),
        ).rejects.toThrow();
        await expect(
          manager.purgeAndResetProvider('myProvider'),
        ).rejects.toThrow();
        await expect(
          manager.deleteEntityRecordsByRef([
            { entityRef: 'component:default/x' },
          ]),
        ).rejects.toThrow();
        await expect(
          manager.computeRemoved('myProvider', uuid()),
        ).rejects.toThrow();
        await expect(manager.getEntityCountsByKind(uuid())).rejects.toThrow();
        await expect(manager.healthcheck()).rejects.toThrow();
        await expect(manager.getLastMark(uuid())).rejects.toThrow();
        await expect(manager.getFirstMark(uuid())).rejects.toThrow();
        await expect(manager.getAllMarks(uuid())).rejects.toThrow();
        await expect(
          manager.createMark({
            record: {
              id: uuid(),
              ingestion_id: uuid(),
              sequence: 1,
              cursor: {},
            },
          }),
        ).rejects.toThrow();
        await expect(
          manager.createMarkEntities(uuid(), [{ entity: makeEntity('x') }]),
        ).rejects.toThrow();
        await expect(manager.purgeTable('ingestions')).rejects.toThrow();
        await expect(manager.listProviders()).rejects.toThrow();
        await expect(manager.cleanupProviders()).rejects.toThrow();
      },
    );

    it.each(databases.eachSupportedId())(
      'rejects mark reads when the stored cursor is corrupt, %p',
      async databaseId => {
        const { knex, manager } = await setup(databaseId);
        const { ingestionId } = (await manager.createProviderIngestionRecord(
          'myProvider',
        ))!;

        await knex('ingestion_marks').insert({
          id: uuid(),
          ingestion_id: ingestionId,
          sequence: 1,
          cursor: 'not-json',
        });

        await expect(manager.getLastMark(ingestionId)).rejects.toThrow(
          /Failed to decode mark cursor/,
        );
      },
    );
  });
});
