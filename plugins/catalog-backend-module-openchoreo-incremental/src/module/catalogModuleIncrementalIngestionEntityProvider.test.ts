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
 * Test suite for catalogModuleOpenchoreoIncrementalEntityProvider and
 * catalogModuleOpenchoreoIncrementalProvider.
 * Drives both backend modules through startTestBackend with a recording
 * catalogProcessingExtensionPoint double. Incremental ingestion is opt-in:
 * without the openchoreo.features.incrementalIngestion.enabled flag no
 * provider is added and no migrations run; with the flag the wrapped
 * OpenChoreoIncrementalEntityProvider is added, and driving its connect()
 * engages the real migrations on the injected SQLite client and registers
 * the scheduler task.
 */
import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import { TestDatabases } from '@backstage/backend-test-utils';
import type { SchedulerService } from '@backstage/backend-plugin-api';
import {
  coreServices,
  createServiceFactory,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { catalogModuleOpenchoreoIncrementalProvider } from './openchoreoIncrementalProviderModule';
import { catalogModuleOpenchoreoIncrementalEntityProvider } from './catalogModuleIncrementalIngestionEntityProvider';
import { DB_MIGRATIONS_TABLE } from '../database/tables';

jest.setTimeout(60_000);

const EXPECTED_MIGRATION_NAMES = [
  '20221116073152_init.js',
  '20240110000001_add_performance_indexes.js',
  '20240110000003_expand_last_error_field.js',
];

/** A recording scheduler factory exposing scheduleTask to the test. */
function makeSchedulerFactory() {
  const scheduleTask = jest.fn();
  const factory = createServiceFactory({
    service: coreServices.scheduler,
    deps: {},
    factory: async () => ({ scheduleTask } as unknown as SchedulerService),
  });
  return { scheduleTask, factory };
}

describe('catalogModuleOpenchoreoIncrementalEntityProvider', () => {
  // SQLITE_3 runs everywhere with no docker dependency; the PostgreSQL
  // variants of the migration are exercised in deployment environments.
  const databases = TestDatabases.create({
    ids: ['SQLITE_3'],
  });

  it('stays idle without the incrementalIngestion.enabled flag', async () => {
    const knex = await databases.init('SQLITE_3');
    const addEntityProvider = jest.fn();
    const scheduler = makeSchedulerFactory();

    const backend = await startTestBackend({
      extensionPoints: [
        [catalogProcessingExtensionPoint, { addEntityProvider }],
      ],
      features: [
        mockServices.database.factory({ knex }),
        scheduler.factory,
        catalogModuleOpenchoreoIncrementalEntityProvider,
        catalogModuleOpenchoreoIncrementalProvider,
      ],
    });

    try {
      expect(addEntityProvider).not.toHaveBeenCalled();
      expect(scheduler.scheduleTask).not.toHaveBeenCalled();

      // The module never touched the database: no migrations were applied.
      await expect(knex(DB_MIGRATIONS_TABLE).select('name')).rejects.toThrow();
    } finally {
      await backend.stop();
    }
  });

  it('adds the wrapped provider and engages migrations and scheduling when the flag is true', async () => {
    const knex = await databases.init('SQLITE_3');
    const addEntityProvider = jest.fn();
    const scheduler = makeSchedulerFactory();

    const backend = await startTestBackend({
      extensionPoints: [
        [catalogProcessingExtensionPoint, { addEntityProvider }],
      ],
      features: [
        mockServices.rootConfig.factory({
          data: {
            openchoreo: {
              baseUrl: 'http://localhost:8080',
              features: { incrementalIngestion: { enabled: true } },
            },
          },
        }),
        mockServices.database.factory({ knex }),
        scheduler.factory,
        catalogModuleOpenchoreoIncrementalEntityProvider,
        catalogModuleOpenchoreoIncrementalProvider,
      ],
    });

    try {
      expect(addEntityProvider).toHaveBeenCalledTimes(1);
      const wrapped = addEntityProvider.mock.calls[0][0];
      expect(wrapped.getProviderName()).toBe(
        'OpenChoreoIncrementalEntityProvider',
      );

      // Drive the wrapped provider the way the catalog engine would. The
      // wrapper is not injectable at the module layer, so engagement is
      // asserted through the real migrations applied to the injected client
      // and through the registered scheduler task.
      await wrapped.connect({ applyMutation: jest.fn(), refresh: jest.fn() });

      const names = (await knex(DB_MIGRATIONS_TABLE).select('name')).map(
        (row: { name: string }) => row.name,
      );
      expect(names.sort()).toEqual(EXPECTED_MIGRATION_NAMES);

      expect(scheduler.scheduleTask).toHaveBeenCalledTimes(1);
      expect(scheduler.scheduleTask).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'OpenChoreoIncrementalEntityProvider',
        }),
      );
    } finally {
      await backend.stop();
    }
  });
});
