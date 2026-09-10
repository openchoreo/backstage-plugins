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
 * Test suite for OpenChoreoIncrementalIngestionEngine.
 * Verifies state-machine transitions (rest, ingest, backoff, cancel),
 * burst pacing, mark()/delta semantics including removal thresholds, and
 * event handling, all against mocked database manager, provider and
 * catalog connection.
 */
import { mockServices } from '@backstage/backend-test-utils';
import type { EntityProviderConnection } from '@backstage/plugin-catalog-node';
import type { DeferredEntity } from '@backstage/plugin-catalog-node';
import type { EventParams } from '@backstage/plugin-events-node';
import type { Duration } from 'luxon';
import type { OpenChoreoIncrementalIngestionDatabaseManager } from '../database/OpenChoreoIncrementalIngestionDatabaseManager';
import type { IterationEngineOptions } from '../types';
import { OpenChoreoIncrementalIngestionEngine } from './OpenChoreoIncrementalIngestionEngine';

function createMockManager() {
  return {
    getCurrentIngestionRecord: jest.fn(),
    createProviderIngestionRecord: jest.fn(),
    setProviderComplete: jest.fn(),
    clearFinishedIngestions: jest.fn(),
    setProviderBursting: jest.fn(),
    setProviderResting: jest.fn(),
    setProviderInterstitial: jest.fn(),
    setProviderCanceling: jest.fn(),
    setProviderCanceled: jest.fn(),
    setProviderBackoff: jest.fn(),
    setProviderIngesting: jest.fn(),
    getLastMark: jest.fn(),
    getFirstMark: jest.fn(),
    createMark: jest.fn(),
    createMarkEntities: jest.fn(),
    getEntityCountsByKind: jest.fn(),
    computeRemoved: jest.fn(),
    updateIngestionRecordById: jest.fn(),
    deleteEntityRecordsByRef: jest.fn(),
  };
}

function createMockProvider() {
  return {
    getProviderName: jest.fn(() => 'test-provider'),
    next: jest.fn(),
    around: jest.fn(async (burst: (context: unknown) => Promise<void>) => {
      await burst({ marker: 'context' });
    }),
    eventHandler: undefined as
      | { onEvent: jest.Mock; supportsEventTopics: () => string[] }
      | undefined,
  };
}

/** A row of the `ingestions` table as the engine reads it. */
function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ing-1',
    provider_name: 'test-provider',
    status: 'bursting',
    next_action: 'ingest',
    attempts: 0,
    next_action_at: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function makeDeferred(kind: string, name: string): DeferredEntity {
  return {
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind,
      metadata: { namespace: 'default', name },
    },
  };
}

/**
 * The engine normalizes deferred entities on their way into a delta,
 * guaranteeing a (possibly empty) annotations object on each entity.
 */
function asApplied(deferred: DeferredEntity): DeferredEntity {
  return {
    ...deferred,
    entity: {
      ...deferred.entity,
      metadata: { ...deferred.entity.metadata, annotations: {} },
    },
  };
}

function createHarness(overrides: Partial<IterationEngineOptions> = {}) {
  const manager = createMockManager();
  const provider = createMockProvider();
  const connection: EntityProviderConnection = {
    applyMutation: jest.fn(),
    refresh: jest.fn(),
  };
  const options: IterationEngineOptions = {
    logger: mockServices.logger.mock(),
    connection,
    manager:
      manager as unknown as OpenChoreoIncrementalIngestionDatabaseManager,
    provider: provider as unknown as IterationEngineOptions['provider'],
    restLength: { minutes: 1 },
    burstLength: { seconds: 30 },
    ready: Promise.resolve(),
    backoff: [{ minutes: 1 }],
    ...overrides,
  };
  const engine = new OpenChoreoIncrementalIngestionEngine(options);
  return { engine, manager, provider, connection };
}

describe('OpenChoreoIncrementalIngestionEngine', () => {
  const signal = () => new AbortController().signal;

  it('starts a new ingestion cycle when the rest period is past due', async () => {
    const { engine, manager, provider } = createHarness();
    manager.getCurrentIngestionRecord.mockResolvedValue(
      makeRecord({
        status: 'resting',
        next_action: 'rest',
        next_action_at: new Date(Date.now() - 60_000),
      }),
    );

    await engine.handleNextAction(signal());

    expect(manager.setProviderComplete).toHaveBeenCalledWith('ing-1');
    expect(manager.clearFinishedIngestions).toHaveBeenCalledWith(
      'test-provider',
    );
    expect(provider.next).not.toHaveBeenCalled();
  });

  it('keeps resting while the rest period is not due', async () => {
    const { engine, manager } = createHarness();
    manager.getCurrentIngestionRecord.mockResolvedValue(
      makeRecord({
        status: 'resting',
        next_action: 'rest',
        next_action_at: new Date(Date.now() + 60_000),
      }),
    );

    await engine.handleNextAction(signal());

    expect(manager.setProviderComplete).not.toHaveBeenCalled();
    expect(manager.clearFinishedIngestions).not.toHaveBeenCalled();
  });

  it('transitions to resting when the burst finishes with done', async () => {
    const { engine, manager, provider } = createHarness();
    manager.getCurrentIngestionRecord.mockResolvedValue(
      makeRecord({ next_action: 'ingest' }),
    );
    manager.getLastMark.mockResolvedValue(undefined);
    manager.getEntityCountsByKind.mockResolvedValue({ total: 0 });
    manager.computeRemoved.mockResolvedValue({ total: 0, removed: [] });
    provider.next.mockResolvedValue({ done: true });

    await engine.handleNextAction(signal());

    expect(manager.setProviderBursting).toHaveBeenCalledWith('ing-1');
    expect(manager.setProviderResting).toHaveBeenCalledTimes(1);
    expect(manager.setProviderResting.mock.calls[0][0]).toBe('ing-1');
    expect(
      (manager.setProviderResting.mock.calls[0][1] as Duration).as(
        'milliseconds',
      ),
    ).toBe(60_000);
    expect(manager.setProviderInterstitial).not.toHaveBeenCalled();
  });

  it('transitions to interstitial when the burst ends unfinished', async () => {
    const { engine, manager, provider } = createHarness();
    manager.getCurrentIngestionRecord.mockResolvedValue(
      makeRecord({ next_action: 'ingest' }),
    );
    manager.getLastMark.mockResolvedValue(undefined);
    const controller = new AbortController();
    provider.next.mockImplementationOnce(async () => {
      controller.abort();
      return {
        done: false,
        entities: [makeDeferred('Component', 'svc-1')],
        cursor: { page: 1 },
      };
    });

    await engine.handleNextAction(controller.signal);

    expect(provider.next).toHaveBeenCalledTimes(1);
    expect(manager.createMark).toHaveBeenCalledTimes(1);
    expect(manager.setProviderInterstitial).toHaveBeenCalledWith('ing-1');
    expect(manager.setProviderResting).not.toHaveBeenCalled();
  });

  it('cuts a never-done burst short once burstLength elapses', async () => {
    const { engine, manager, provider } = createHarness({
      burstLength: { milliseconds: 1 },
    });
    manager.getCurrentIngestionRecord.mockResolvedValue(
      makeRecord({ next_action: 'ingest' }),
    );
    manager.getLastMark.mockResolvedValue(undefined);
    provider.next.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return { done: false, entities: [], cursor: { page: 'more' } };
    });

    await engine.handleNextAction(signal());

    // The provider never finishes, so only the burst length can have
    // stopped it — after exactly one batch.
    expect(provider.next).toHaveBeenCalledTimes(1);
    expect(manager.createMark).toHaveBeenCalledTimes(1);
    expect(manager.setProviderInterstitial).toHaveBeenCalledWith('ing-1');
    expect(manager.setProviderResting).not.toHaveBeenCalled();
  });

  it('backs off when the provider throws during a burst', async () => {
    const { engine, manager, provider } = createHarness();
    manager.getCurrentIngestionRecord.mockResolvedValue(
      makeRecord({ next_action: 'ingest' }),
    );
    manager.getLastMark.mockResolvedValue(undefined);
    manager.getEntityCountsByKind.mockResolvedValue({ total: 0 });
    provider.next.mockRejectedValue(new Error('boom'));

    await engine.handleNextAction(signal());

    expect(manager.setProviderBackoff).toHaveBeenCalledTimes(1);
    expect(manager.setProviderBackoff.mock.calls[0][0]).toBe('ing-1');
    expect(manager.setProviderBackoff.mock.calls[0][1]).toBe(0);
    expect((manager.setProviderBackoff.mock.calls[0][2] as Error).message).toBe(
      'boom',
    );
    expect(manager.setProviderBackoff.mock.calls[0][3]).toBe(60_000);
    expect(manager.createMark).not.toHaveBeenCalled();
    expect(manager.setProviderInterstitial).not.toHaveBeenCalled();
    expect(manager.setProviderResting).not.toHaveBeenCalled();
  });

  it("cancels on a 'CANCEL' error instead of backing off", async () => {
    const { engine, manager, provider } = createHarness();
    manager.getCurrentIngestionRecord.mockResolvedValue(
      makeRecord({ next_action: 'ingest' }),
    );
    manager.getLastMark.mockResolvedValue(undefined);
    provider.next.mockRejectedValue(new Error('CANCEL'));

    await engine.handleNextAction(signal());

    expect(manager.setProviderCanceling).toHaveBeenCalledWith(
      'ing-1',
      'CANCEL',
    );
    expect(manager.setProviderBackoff).not.toHaveBeenCalled();
  });

  it('applies a dependency-sorted delta with removed refs on the final mark', async () => {
    const { engine, manager, connection } = createHarness();
    manager.getEntityCountsByKind.mockResolvedValue({
      total: 2,
      Domain: 1,
      Component: 1,
    });
    manager.computeRemoved.mockResolvedValue({
      total: 2,
      removed: [{ entityRef: 'component:default/gone' }],
    });

    const domainEntity = makeDeferred('Domain', 'ns-1');
    const componentEntity = makeDeferred('Component', 'svc-1');
    await engine.mark({
      id: 'ing-1',
      sequence: 3,
      entities: [componentEntity, domainEntity],
      done: true,
      cursor: { phase: 'components' },
    });

    expect(manager.createMark).toHaveBeenCalledWith({
      record: {
        id: expect.any(String),
        ingestion_id: 'ing-1',
        cursor: { phase: 'components' },
        sequence: 3,
      },
    });
    expect(manager.createMarkEntities).toHaveBeenCalledTimes(1);
    expect(connection.applyMutation).toHaveBeenCalledWith({
      type: 'delta',
      added: [asApplied(domainEntity), asApplied(componentEntity)],
      removed: [{ entityRef: 'component:default/gone' }],
    });
  });

  it('blocks removals above the configured percentage and records last_error', async () => {
    const { engine, manager, connection } = createHarness({
      rejectRemovalsAbovePercentage: 10,
    });
    manager.getEntityCountsByKind.mockResolvedValue({
      total: 10,
      Component: 10,
    });
    manager.computeRemoved.mockResolvedValue({
      total: 10,
      removed: [
        { entityRef: 'component:default/a' },
        { entityRef: 'component:default/b' },
      ],
    });

    const added = makeDeferred('Component', 'svc-1');
    await engine.mark({
      id: 'ing-1',
      sequence: 0,
      entities: [added],
      done: true,
    });

    // 2 of 10 entities (20%) would be removed, above the 10% threshold.
    expect(manager.updateIngestionRecordById).toHaveBeenCalledWith({
      ingestionId: 'ing-1',
      update: { last_error: expect.stringContaining('REMOVAL_THRESHOLD') },
    });
    expect(connection.applyMutation).toHaveBeenCalledWith({
      type: 'delta',
      added: [asApplied(added)],
      removed: [],
    });
  });

  it('ignores events whose topic is not supported', async () => {
    const { engine, provider, connection } = createHarness();
    const onEvent = jest.fn();
    provider.eventHandler = {
      onEvent,
      supportsEventTopics: () => ['openchoreo.test'],
    };

    await engine.onEvent({ topic: 'other.topic' } as EventParams);

    expect(onEvent).not.toHaveBeenCalled();
    expect(connection.applyMutation).not.toHaveBeenCalled();
  });

  it('persists and applies delta results from supported events', async () => {
    const { engine, manager, provider, connection } = createHarness();
    const delta = {
      type: 'delta' as const,
      added: [makeDeferred('Component', 'evt-1')],
      removed: [{ entityRef: 'component:default/gone' }],
    };
    provider.eventHandler = {
      onEvent: jest.fn().mockResolvedValue(delta),
      supportsEventTopics: () => ['openchoreo.test'],
    };
    manager.getCurrentIngestionRecord.mockResolvedValue(
      makeRecord({ status: 'bursting' }),
    );
    manager.getFirstMark.mockResolvedValue({
      id: 'mark-1',
      sequence: 0,
      cursor: null,
    });

    await engine.onEvent({ topic: 'openchoreo.test' } as EventParams);

    expect(manager.createMarkEntities).toHaveBeenCalledWith(
      'mark-1',
      delta.added,
    );
    expect(manager.deleteEntityRecordsByRef).toHaveBeenCalledWith(
      delta.removed,
    );
    expect(connection.applyMutation).toHaveBeenCalledWith(delta);
  });
});
