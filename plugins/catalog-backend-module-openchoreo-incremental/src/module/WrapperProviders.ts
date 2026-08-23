/*
 * Copyright 2022 The Backstage Authors
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

import type {
  LoggerService,
  RootConfigService,
  SchedulerService,
} from '@backstage/backend-plugin-api';
import type {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import type { EventsService } from '@backstage/plugin-events-node';
import type express from 'express';
import type { Knex } from 'knex';
import type { applyDatabaseMigrations } from '../database/migrations';
import type {
  IncrementalEntityProvider,
  IncrementalEntityProviderOptions,
} from '../types';

/**
 * WrapperProviders class for managing incremental entity providers.
 * Handles initialization, database migrations, scheduling, and event
 * subscriptions for providers that support burst-based, resumable entity
 * ingestion.
 */

/**
 * Helps in the creation of the catalog entity providers that wrap the
 * incremental ones.
 */
export class WrapperProviders {
  constructor(
    readonly options: {
      config: RootConfigService;
      logger: LoggerService;
      client: Knex;
      scheduler: SchedulerService;
      applyDatabaseMigrations?: typeof applyDatabaseMigrations;
      events: EventsService;
    },
  ) {}

  wrap(
    provider: IncrementalEntityProvider<unknown, unknown>,
    _options: IncrementalEntityProviderOptions,
  ): EntityProvider {
    return {
      getProviderName: () => provider.getProviderName(),
      connect: async (_connection: EntityProviderConnection) => {
        throw new Error('M3: not implemented');
      },
    };
  }

  adminRouter(): express.Router {
    throw new Error('M3: not implemented');
  }

  /**
   * Waits for all wrapped providers to complete their initial connection.
   * This is useful for tests or initialization code that needs to ensure
   * all providers are ready before proceeding.
   */
  waitForReady(): Promise<void> {
    throw new Error('M3: not implemented');
  }
}
