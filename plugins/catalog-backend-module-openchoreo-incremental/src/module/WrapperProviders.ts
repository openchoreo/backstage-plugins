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

import {
  LoggerService,
  RootConfigService,
  SchedulerService,
} from '@backstage/backend-plugin-api';
import { stringifyError } from '@backstage/errors';
import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { createDeferred } from '@backstage/types';
import express from 'express';
import { Knex } from 'knex';
import { Duration } from 'luxon';
import { OpenChoreoIncrementalIngestionDatabaseManager } from '../database/OpenChoreoIncrementalIngestionDatabaseManager';
import { applyDatabaseMigrations } from '../database/migrations';
import { OpenChoreoIncrementalIngestionEngine } from '../engine/OpenChoreoIncrementalIngestionEngine';
import { IncrementalProviderRouter } from '../router/routes';
import {
  IncrementalEntityProvider,
  IncrementalEntityProviderOptions,
} from '../types';
import { EventsService } from '@backstage/plugin-events-node';

const MINIMUM_SCHEDULER_INTERVAL_MS = 5000;
const BURST_LENGTH_MARGIN_MINUTES = 1;

/**
 * WrapperProviders class for managing incremental entity providers.
 * Handles initialization, database migrations, scheduling, and event subscriptions
 * for providers that support burst-based, resumable entity ingestion.
 */

/**
 * Helps in the creation of the catalog entity providers that wrap the
 * incremental ones.
 */
export class WrapperProviders {
  private migrate: Promise<void> | undefined;
  private numberOfProvidersToConnect = 0;
  private readonly readySignal = createDeferred();

  constructor(
    private readonly options: {
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
    options: IncrementalEntityProviderOptions,
  ): EntityProvider {
    this.numberOfProvidersToConnect += 1;
    return {
      getProviderName: () => provider.getProviderName(),
      connect: async connection => {
        try {
          await this.startProvider(provider, options, connection);
        } finally {
          this.numberOfProvidersToConnect -= 1;
          if (this.numberOfProvidersToConnect === 0) {
            this.readySignal.resolve();
          }
        }
      },
    };
  }

  adminRouter(): express.Router {
    return new IncrementalProviderRouter(
      new OpenChoreoIncrementalIngestionDatabaseManager({
        client: this.options.client,
        logger: this.options.logger,
      }),
      this.options.logger,
    ).createRouter();
  }

  /**
   * Waits for all wrapped providers to complete their initial connection.
   * This is useful for tests or initialization code that needs to ensure
   * all providers are ready before proceeding.
   */
  waitForReady(): Promise<void> {
    return this.readySignal;
  }

  private async startProvider(
    provider: IncrementalEntityProvider<unknown, unknown>,
    providerOptions: IncrementalEntityProviderOptions,
    connection: EntityProviderConnection,
  ) {
    const logger = this.options.logger.child({
      entityProvider: provider.getProviderName(),
    });

    try {
      if (!this.migrate) {
        this.migrate = Promise.resolve().then(async () => {
          const apply =
            this.options.applyDatabaseMigrations ?? applyDatabaseMigrations;
          await apply(this.options.client);
        });
      }

      await this.migrate;

      const { burstInterval, burstLength, restLength } = providerOptions;

      logger.info(`Connecting`);

      const manager = new OpenChoreoIncrementalIngestionDatabaseManager({
        client: this.options.client,
        logger,
      });
      const engine = new OpenChoreoIncrementalIngestionEngine({
        ...providerOptions,
        ready: this.readySignal,
        manager,
        logger,
        provider,
        restLength,
        connection,
      });

      let frequency = Duration.isDuration(burstInterval)
        ? burstInterval
        : Duration.fromObject(burstInterval);
      if (frequency.as('milliseconds') < MINIMUM_SCHEDULER_INTERVAL_MS) {
        frequency = Duration.fromMillis(MINIMUM_SCHEDULER_INTERVAL_MS);
      }

      let length = Duration.isDuration(burstLength)
        ? burstLength
        : Duration.fromObject(burstLength);
      length = length.plus(
        Duration.fromObject({ minutes: BURST_LENGTH_MARGIN_MINUTES }),
      );

      await this.options.scheduler.scheduleTask({
        id: provider.getProviderName(),
        fn: engine.taskFn.bind(engine),
        frequency,
        timeout: length,
      });

      const topics = engine.supportsEventTopics();
      if (topics.length > 0) {
        logger.info(
          `Provider ${provider.getProviderName()} subscribing to events for topics: ${topics.join(
            ',',
          )}`,
        );
        await this.options.events.subscribe({
          topics,
          id: `catalog-backend-module-incremental-ingestion:${provider.getProviderName()}`,
          onEvent: evt => engine.onEvent(evt),
        });
      }
    } catch (error) {
      logger.warn(
        `Failed to initialize incremental ingestion provider ${provider.getProviderName()}, ${stringifyError(
          error,
        )}`,
      );
      throw error;
    }
  }
}
