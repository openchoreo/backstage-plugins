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
 * Test suite for WrapperProviders.
 * Verifies provider wrapping, the shared one-shot migrations gate, scheduler
 * task registration, event subscription for topic-supporting providers, and
 * the ready signal semantics. The migrations applier is injected as a
 * counting fake over a dummy knex object, so no real database is needed.
 */
import type { SchedulerService } from '@backstage/backend-plugin-api';
import { mockServices } from '@backstage/backend-test-utils';
import type { EntityProviderConnection } from '@backstage/plugin-catalog-node';
import type { EventsService } from '@backstage/plugin-events-node';
import type { Knex } from 'knex';
import type {
  IncrementalEntityProvider,
  IncrementalEntityProviderOptions,
} from '../types';
import { WrapperProviders } from './WrapperProviders';

// WrapperProviders caches its shared migrations promise at module scope, so
// an isolated module registry is used per test to keep the "runs exactly
// once" assertions deterministic regardless of test ordering.
function freshWrapperProviders(): typeof WrapperProviders {
  let fresh: typeof WrapperProviders | undefined;
  jest.isolateModules(() => {
    fresh = require('./WrapperProviders').WrapperProviders;
  });
  return fresh!;
}

/**
 * The only thing read off the client before connect completes is the knex
 * dialect name, used by the database manager for batch sizing.
 */
const dummyClient = {
  client: { config: { client: 'sqlite3' } },
} as unknown as Knex;

function makeProvider(
  name: string,
  eventHandler?: IncrementalEntityProvider<unknown, unknown>['eventHandler'],
): IncrementalEntityProvider<unknown, unknown> {
  return {
    getProviderName: () => name,
    around: async burst => {
      await burst(undefined);
    },
    next: async () => ({ done: true }),
    ...(eventHandler ? { eventHandler } : {}),
  };
}

const providerOptions: IncrementalEntityProviderOptions = {
  burstInterval: { seconds: 30 },
  burstLength: { seconds: 30 },
  restLength: { minutes: 30 },
};

function makeHarness() {
  const scheduler = { scheduleTask: jest.fn() };
  const events = { subscribe: jest.fn() };
  return { scheduler, events };
}

describe('WrapperProviders', () => {
  it('wrap() returns an entity provider named after the wrapped provider', async () => {
    const FreshWrapperProviders = freshWrapperProviders();
    const { scheduler, events } = makeHarness();

    const providers = new FreshWrapperProviders({
      config: mockServices.rootConfig.mock(),
      logger: mockServices.logger.mock(),
      client: dummyClient,
      scheduler: scheduler as unknown as SchedulerService,
      events: events as unknown as EventsService,
    });

    const wrapped = providers.wrap(makeProvider('provider-x'), providerOptions);

    expect(typeof wrapped.getProviderName).toBe('function');
    expect(typeof wrapped.connect).toBe('function');
    expect(wrapped.getProviderName()).toBe('provider-x');
  });

  it('connect() awaits the shared migrations before scheduling the task', async () => {
    const FreshWrapperProviders = freshWrapperProviders();
    const { scheduler, events } = makeHarness();

    const applyDatabaseMigrations = jest.fn();
    let releaseMigrations!: () => void;
    const migrationsGate = new Promise<void>(resolve => {
      releaseMigrations = resolve;
    });
    applyDatabaseMigrations.mockImplementation(async () => {
      await migrationsGate;
    });

    const providers = new FreshWrapperProviders({
      config: mockServices.rootConfig.mock(),
      logger: mockServices.logger.mock(),
      client: dummyClient,
      scheduler: scheduler as unknown as SchedulerService,
      applyDatabaseMigrations,
      events: events as unknown as EventsService,
    });

    const connection: EntityProviderConnection = {
      applyMutation: jest.fn(),
      refresh: jest.fn(),
    };

    const connectPromise = providers
      .wrap(makeProvider('provider-1'), providerOptions)
      .connect(connection);
    await new Promise(resolve => setImmediate(resolve));

    // The migrations gate is still closed: the applier ran once with the
    // shared client, but nothing downstream has happened yet.
    expect(applyDatabaseMigrations).toHaveBeenCalledTimes(1);
    expect(applyDatabaseMigrations).toHaveBeenCalledWith(dummyClient);
    expect(scheduler.scheduleTask).not.toHaveBeenCalled();
    expect(events.subscribe).not.toHaveBeenCalled();

    releaseMigrations();
    await connectPromise;

    expect(scheduler.scheduleTask).toHaveBeenCalledTimes(1);
    const task = (scheduler.scheduleTask as jest.Mock).mock.calls[0][0];
    expect(task.id).toBe('provider-1');
    expect(task.fn).toEqual(expect.any(Function));
    expect(task.frequency.as('milliseconds')).toBe(30_000);
    // The scheduled timeout includes the burst length plus a safety margin.
    expect(task.timeout.as('milliseconds')).toBe(90_000);

    // The provider reports no event topics, so no subscription happens.
    expect(events.subscribe).not.toHaveBeenCalled();
  });

  it('clamps too-short burst intervals up to the scheduler minimum', async () => {
    const FreshWrapperProviders = freshWrapperProviders();
    const { scheduler, events } = makeHarness();

    const providers = new FreshWrapperProviders({
      config: mockServices.rootConfig.mock(),
      logger: mockServices.logger.mock(),
      client: dummyClient,
      scheduler: scheduler as unknown as SchedulerService,
      applyDatabaseMigrations: jest.fn(async () => {}),
      events: events as unknown as EventsService,
    });

    await providers
      .wrap(
        makeProvider('provider-fast'),
        // 1 second is below the 5 second scheduler minimum.
        {
          ...providerOptions,
          burstInterval: { seconds: 1 },
          burstLength: { seconds: 1 },
        },
      )
      .connect({ applyMutation: jest.fn(), refresh: jest.fn() });

    const task = (scheduler.scheduleTask as jest.Mock).mock.calls[0][0];
    expect(task.frequency.as('milliseconds')).toBe(5_000);
    expect(task.timeout.as('milliseconds')).toBe(61_000);
  });

  it('connects two providers in parallel while running the migrations exactly once', async () => {
    const FreshWrapperProviders = freshWrapperProviders();
    const { scheduler, events } = makeHarness();

    const applyDatabaseMigrations = jest.fn();
    let releaseMigrations!: () => void;
    const migrationsGate = new Promise<void>(resolve => {
      releaseMigrations = resolve;
    });
    applyDatabaseMigrations.mockImplementation(async () => {
      await migrationsGate;
    });

    const providers = new FreshWrapperProviders({
      config: mockServices.rootConfig.mock(),
      logger: mockServices.logger.mock(),
      client: dummyClient,
      scheduler: scheduler as unknown as SchedulerService,
      applyDatabaseMigrations,
      events: events as unknown as EventsService,
    });

    const connection: EntityProviderConnection = {
      applyMutation: jest.fn(),
      refresh: jest.fn(),
    };

    const connectA = providers
      .wrap(makeProvider('provider-a'), providerOptions)
      .connect(connection);
    const connectB = providers
      .wrap(makeProvider('provider-b'), providerOptions)
      .connect(connection);
    await new Promise(resolve => setImmediate(resolve));

    // Both providers are parked on the same gated migration run.
    expect(applyDatabaseMigrations).toHaveBeenCalledTimes(1);
    expect(scheduler.scheduleTask).not.toHaveBeenCalled();

    releaseMigrations();
    await Promise.all([connectA, connectB]);

    expect(applyDatabaseMigrations).toHaveBeenCalledTimes(1);
    const scheduledIds = (scheduler.scheduleTask as jest.Mock).mock.calls.map(
      call => call[0].id,
    );
    expect(scheduledIds).toEqual(['provider-a', 'provider-b']);
  });

  it('subscribes to events only when the provider reports topics', async () => {
    const FreshWrapperProviders = freshWrapperProviders();
    const { scheduler, events } = makeHarness();

    const providers = new FreshWrapperProviders({
      config: mockServices.rootConfig.mock(),
      logger: mockServices.logger.mock(),
      client: dummyClient,
      scheduler: scheduler as unknown as SchedulerService,
      applyDatabaseMigrations: jest.fn(async () => {}),
      events: events as unknown as EventsService,
    });

    const topics = ['openchoreo.namespace', 'openchoreo.project'];
    await providers
      .wrap(
        makeProvider('provider-events', {
          onEvent: jest.fn(),
          supportsEventTopics: () => topics,
        }),
        providerOptions,
      )
      .connect({ applyMutation: jest.fn(), refresh: jest.fn() });

    expect(events.subscribe).toHaveBeenCalledTimes(1);
    expect(events.subscribe).toHaveBeenCalledWith({
      topics,
      id: 'catalog-backend-module-incremental-ingestion:provider-events',
      onEvent: expect.any(Function),
    });
  });

  it('resolves the ready signal only after every wrapped provider connected', async () => {
    const FreshWrapperProviders = freshWrapperProviders();
    const { scheduler, events } = makeHarness();

    const providers = new FreshWrapperProviders({
      config: mockServices.rootConfig.mock(),
      logger: mockServices.logger.mock(),
      client: dummyClient,
      scheduler: scheduler as unknown as SchedulerService,
      applyDatabaseMigrations: jest.fn(async () => {}),
      events: events as unknown as EventsService,
    });

    const connection: EntityProviderConnection = {
      applyMutation: jest.fn(),
      refresh: jest.fn(),
    };

    const wrapped1 = providers.wrap(
      makeProvider('provider-1'),
      providerOptions,
    );
    const wrapped2 = providers.wrap(
      makeProvider('provider-2'),
      providerOptions,
    );

    let ready = false;
    providers.waitForReady().then(() => {
      ready = true;
    });

    await wrapped1.connect(connection);
    expect(ready).toBe(false);

    await wrapped2.connect(connection);
    expect(ready).toBe(true);
    await expect(providers.waitForReady()).resolves.toBeUndefined();
  });
});
