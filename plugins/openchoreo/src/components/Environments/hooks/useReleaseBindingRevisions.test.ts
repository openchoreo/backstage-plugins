import { act, renderHook, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { createQueryWrapper } from '@openchoreo/test-utils';
import type { ReleaseBindingRevision } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useReleaseBindingRevisions } from './useReleaseBindingRevisions';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'api',
    namespace: 'default',
    annotations: {
      'openchoreo.io/namespace': 'default',
      'openchoreo.io/project': 'shop',
      'openchoreo.io/component': 'api',
    },
  },
};

const makeRevision = (
  n: number,
  health: string,
  active = false,
): ReleaseBindingRevision =>
  ({
    metadata: { name: `api-development-r${n}` },
    spec: {
      revision: n,
      cause: 'Deploy',
      bindingSpec: {
        owner: { projectName: 'shop', componentName: 'api' },
        releaseName: `api-v${n}`,
      },
    },
    status: { health, active, knownGood: health === 'Healthy' },
  } as unknown as ReleaseBindingRevision);

const POLL_MS = 40;

function renderRevisions(
  listReleaseBindingRevisions: jest.Mock,
  { environment }: { environment?: string } = { environment: 'development' },
) {
  const client = { listReleaseBindingRevisions } as any;
  return renderHook(
    ({ env }) =>
      useReleaseBindingRevisions(entity, env, 'api-development', {
        pollIntervalMs: POLL_MS,
        awaitTimeoutMs: 2000,
      }),
    {
      initialProps: { env: environment },
      wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
    },
  );
}

/** Lets several poll intervals pass. */
const waitIntervals = (n: number) =>
  act(() => new Promise(resolve => setTimeout(resolve, POLL_MS * n)));

describe('useReleaseBindingRevisions', () => {
  it('returns revisions newest first', async () => {
    const list = jest
      .fn()
      .mockResolvedValue([
        makeRevision(1, 'Healthy'),
        makeRevision(3, 'Healthy', true),
        makeRevision(2, 'Degraded'),
      ]);
    const { result } = renderRevisions(list);

    await waitFor(() => expect(result.current.revisions).toHaveLength(3));
    expect(result.current.revisions.map(r => r.spec.revision)).toEqual([
      3, 2, 1,
    ]);
    expect(list).toHaveBeenCalledWith(entity, 'development', 'api-development');
  });

  it('does not fetch without an environment', async () => {
    const list = jest.fn();
    const { result } = renderRevisions(list, {});

    await waitIntervals(3);
    expect(list).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('does not poll when nothing is Progressing', async () => {
    const list = jest
      .fn()
      .mockResolvedValue([makeRevision(1, 'Healthy', true)]);
    const { result } = renderRevisions(list);

    await waitFor(() => expect(result.current.revisions).toHaveLength(1));
    await waitIntervals(5);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('does not poll for an inactive revision frozen at Progressing', async () => {
    // r1 stopped being active mid-rollout and keeps Progressing; r2 is
    // active and settled, so nothing will change.
    const list = jest
      .fn()
      .mockResolvedValue([
        makeRevision(2, 'Healthy', true),
        makeRevision(1, 'Progressing'),
      ]);
    const { result } = renderRevisions(list);

    await waitFor(() => expect(result.current.revisions).toHaveLength(2));
    await waitIntervals(5);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('polls while a revision is Progressing and stops once it settles', async () => {
    const list = jest
      .fn()
      .mockResolvedValueOnce([makeRevision(2, 'Progressing', true)])
      .mockResolvedValueOnce([makeRevision(2, 'Progressing', true)])
      .mockResolvedValue([makeRevision(2, 'Healthy', true)]);
    const { result } = renderRevisions(list);

    await waitFor(() =>
      expect(result.current.revisions[0]?.status?.health).toBe('Healthy'),
    );
    const callsWhenSettled = list.mock.calls.length;
    expect(callsWhenSettled).toBeGreaterThanOrEqual(3);

    await waitIntervals(5);
    expect(list).toHaveBeenCalledTimes(callsWhenSettled);
  });

  it('after a rollback, polls until the target is active again', async () => {
    const before = [
      makeRevision(2, 'Healthy', true),
      makeRevision(1, 'Healthy'),
    ];
    // No revision is created: r1 becomes active again, at Healthy here so the
    // only reason left to poll is the wait.
    const after = [
      makeRevision(2, 'Healthy'),
      makeRevision(1, 'Healthy', true),
    ];
    // The controller switches a couple of reads after the API call.
    const list = jest
      .fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(before)
      .mockResolvedValue(after);
    const { result } = renderRevisions(list);
    await waitFor(() => expect(result.current.revisions).toHaveLength(2));

    act(() => result.current.awaitRevision('api-development-r1'));

    await waitFor(() =>
      expect(result.current.revisions[1].status?.active).toBe(true),
    );
    expect(result.current.revisions).toHaveLength(2);
    expect(result.current.revisions[0].status?.active).toBe(false);

    // Found it: polling stops.
    const calls = list.mock.calls.length;
    await waitIntervals(5);
    expect(list).toHaveBeenCalledTimes(calls);
  });

  it('after a rollback, does not stop waiting while the target exists but is inactive', async () => {
    // The target r1 is in every list; only its status changes when the
    // controller switches. Reads before the switch must not end the wait.
    const before = [
      makeRevision(2, 'Healthy', true),
      makeRevision(1, 'Healthy'),
    ];
    const switched = [
      makeRevision(2, 'Healthy'),
      makeRevision(1, 'Progressing', true),
    ];
    const list = jest
      .fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(before)
      .mockResolvedValue(switched);
    const { result } = renderRevisions(list);
    await waitFor(() => expect(result.current.revisions).toHaveLength(2));

    act(() => result.current.awaitRevision('api-development-r1'));

    await waitFor(() =>
      expect(result.current.revisions[1].status?.active).toBe(true),
    );
    expect(result.current.revisions[0].status?.active).toBe(false);
    // The reads that showed r1 inactive did not end the wait.
    expect(list.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('gives up waiting for a revision after the timeout', async () => {
    const list = jest
      .fn()
      .mockResolvedValue([makeRevision(1, 'Healthy', true)]);
    const client = { listReleaseBindingRevisions: list } as any;
    const { result } = renderHook(
      () =>
        useReleaseBindingRevisions(entity, 'development', 'api-development', {
          pollIntervalMs: POLL_MS,
          awaitTimeoutMs: POLL_MS * 3,
        }),
      { wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]) },
    );
    await waitFor(() => expect(result.current.revisions).toHaveLength(1));

    act(() => result.current.awaitRevision('api-development-r9'));
    await waitIntervals(6);
    const calls = list.mock.calls.length;
    await waitIntervals(5);
    expect(list).toHaveBeenCalledTimes(calls);
  });

  it('gives up after the timeout even while the list keeps changing', async () => {
    // Every read differs, so the data changes on each poll; the deadline is
    // set when the wait starts and must not move with it.
    let read = 0;
    const list = jest.fn().mockImplementation(async () => [
      {
        ...makeRevision(1, 'Healthy', true),
        spec: {
          revision: 1,
          cause: 'Deploy',
          bindingSpec: {
            owner: { projectName: 'shop', componentName: 'api' },
            releaseName: `api-v${++read}`,
          },
        },
      },
    ]);
    const client = { listReleaseBindingRevisions: list } as any;
    const { result } = renderHook(
      () =>
        useReleaseBindingRevisions(entity, 'development', 'api-development', {
          pollIntervalMs: POLL_MS,
          awaitTimeoutMs: POLL_MS * 3,
        }),
      { wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]) },
    );
    await waitFor(() => expect(result.current.revisions).toHaveLength(1));

    act(() => result.current.awaitRevision('api-development-r9'));
    await waitIntervals(8);
    const calls = list.mock.calls.length;
    await waitIntervals(5);
    expect(list).toHaveBeenCalledTimes(calls);
  });

  it('after a lower history limit, polls until the oldest revisions are gone', async () => {
    const untrimmed = [
      makeRevision(4, 'Healthy', true),
      makeRevision(3, 'Healthy'),
      makeRevision(2, 'Healthy'),
      makeRevision(1, 'Healthy'),
    ];
    const trimmed = untrimmed.slice(0, 2);
    // The controller trims a couple of reads after the limit is saved.
    const list = jest
      .fn()
      .mockResolvedValueOnce(untrimmed)
      .mockResolvedValueOnce(untrimmed)
      .mockResolvedValueOnce(untrimmed)
      .mockResolvedValue(trimmed);
    const { result } = renderRevisions(list);
    await waitFor(() => expect(result.current.revisions).toHaveLength(4));

    act(() => result.current.awaitTrim(1));

    await waitFor(() => expect(result.current.revisions).toHaveLength(2));
    // Trimmed to the limit: polling stops.
    const calls = list.mock.calls.length;
    await waitIntervals(5);
    expect(list).toHaveBeenCalledTimes(calls);
  });

  it('gives up waiting for a trim after its timeout', async () => {
    // Revisions the controller always keeps can stay above the limit.
    const list = jest
      .fn()
      .mockResolvedValue([
        makeRevision(3, 'Healthy', true),
        makeRevision(2, 'Healthy'),
        makeRevision(1, 'Healthy'),
      ]);
    const client = { listReleaseBindingRevisions: list } as any;
    const { result } = renderHook(
      () =>
        useReleaseBindingRevisions(entity, 'development', 'api-development', {
          pollIntervalMs: POLL_MS,
          awaitTrimTimeoutMs: POLL_MS * 3,
        }),
      { wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]) },
    );
    await waitFor(() => expect(result.current.revisions).toHaveLength(3));

    act(() => result.current.awaitTrim(0));
    await waitIntervals(6);
    const calls = list.mock.calls.length;
    await waitIntervals(5);
    expect(list).toHaveBeenCalledTimes(calls);
  });

  describe('for a Resource binding', () => {
    const resourceRevision = (n: number, health: string, active = false) =>
      ({
        metadata: { name: `db-development-r${n}` },
        spec: {
          revision: n,
          cause: 'Deploy',
          bindingSpec: {
            owner: { projectName: 'shop', resourceName: 'db' },
            resourceRelease: `db-v${n}`,
          },
        },
        status: { health, active },
      } as unknown);

    const renderResource = (client: Record<string, jest.Mock>) =>
      renderHook(
        () =>
          useReleaseBindingRevisions(entity, 'development', 'api-development', {
            kind: 'resource',
            pollIntervalMs: POLL_MS,
            awaitTimeoutMs: 2000,
          }),
        { wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]) },
      );

    it('reads the resource release binding revisions, newest first', async () => {
      const listResourceReleaseBindingRevisions = jest
        .fn()
        .mockResolvedValue([
          resourceRevision(1, 'Healthy'),
          resourceRevision(2, 'Healthy', true),
        ]);
      const listReleaseBindingRevisions = jest.fn();
      const { result } = renderResource({
        listResourceReleaseBindingRevisions,
        listReleaseBindingRevisions,
      });

      await waitFor(() => expect(result.current.revisions).toHaveLength(2));
      expect(result.current.revisions.map(r => r.spec.revision)).toEqual([
        2, 1,
      ]);
      expect(listResourceReleaseBindingRevisions).toHaveBeenCalledWith(
        entity,
        'development',
        'api-development',
      );
      expect(listReleaseBindingRevisions).not.toHaveBeenCalled();
    });

    it('polls while a revision is Progressing, then stops once Healthy', async () => {
      const listResourceReleaseBindingRevisions = jest
        .fn()
        .mockResolvedValueOnce([resourceRevision(1, 'Progressing', true)])
        .mockResolvedValueOnce([resourceRevision(1, 'Progressing', true)])
        .mockResolvedValue([resourceRevision(1, 'Healthy', true)]);
      const { result } = renderResource({
        listResourceReleaseBindingRevisions,
      });

      await waitFor(() =>
        expect(result.current.revisions[0]?.status?.health).toBe('Healthy'),
      );
      const calls = listResourceReleaseBindingRevisions.mock.calls.length;
      expect(calls).toBeGreaterThanOrEqual(3);
      await waitIntervals(4);
      expect(listResourceReleaseBindingRevisions).toHaveBeenCalledTimes(calls);
    });
  });
});
