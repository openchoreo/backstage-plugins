import { act, renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { useRuns } from './useRuns';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  calculateTimeRange: jest.fn().mockReturnValue({
    startTime: '2026-03-05T09:00:00.000Z',
    endTime: '2026-03-05T10:00:00.000Z',
  }),
}));

describe('useRuns', () => {
  const getRuns = jest.fn();

  const entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'component-a',
      annotations: {
        'openchoreo.io/namespace': 'dev',
        'openchoreo.io/component': 'component-a',
      },
    },
    spec: { owner: 'group:default/team' },
  };

  const options = {
    environmentId: 'env-1',
    environmentName: 'development',
    timeRange: '24h',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getRuns });
  });

  it('starts with empty runs, no loading, no error', () => {
    const { result } = renderHook(() =>
      useRuns(entity as any, 'dev', 'project-a', options),
    );

    expect(result.current.runs).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.totalCount).toBe(0);
  });

  it('fetchRuns populates runs and totalCount on success', async () => {
    getRuns.mockResolvedValueOnce({
      runs: [
        {
          jobName: 'job-1',
          status: 'succeeded',
          startTime: '2026-03-05T10:00:00.000Z',
          eventCount: 2,
        },
      ],
      total: 1,
      tookMs: 5,
    });

    const { result } = renderHook(() =>
      useRuns(entity as any, 'dev', 'project-a', options),
    );

    await act(async () => {
      await result.current.fetchRuns();
    });

    expect(getRuns).toHaveBeenCalledTimes(1);
    expect(getRuns).toHaveBeenCalledWith(
      'dev',
      'project-a',
      'development',
      'component-a',
      expect.objectContaining({
        limit: 20,
        offset: 0,
        startTime: '2026-03-05T09:00:00.000Z',
        endTime: '2026-03-05T10:00:00.000Z',
        sortOrder: 'desc',
      }),
    );
    expect(result.current.runs).toHaveLength(1);
    expect(result.current.runs[0].jobName).toBe('job-1');
    expect(result.current.totalCount).toBe(1);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('sets error state when the API rejects with an Error', async () => {
    getRuns.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() =>
      useRuns(entity as any, 'dev', 'project-a', options),
    );

    await act(async () => {
      await result.current.fetchRuns();
    });

    expect(result.current.error).toBe('boom');
    expect(result.current.runs).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('uses a generic error message for non-Error rejections', async () => {
    getRuns.mockRejectedValueOnce('unknown');

    const { result } = renderHook(() =>
      useRuns(entity as any, 'dev', 'project-a', options),
    );

    await act(async () => {
      await result.current.fetchRuns();
    });

    expect(result.current.error).toBe('Failed to fetch runs');
  });

  it('skips the API call when required identifiers are missing', async () => {
    const entityNoComponent = {
      ...entity,
      metadata: { name: 'x', annotations: {} },
    };

    const { result } = renderHook(() =>
      useRuns(entityNoComponent as any, 'dev', 'project-a', options),
    );

    await act(async () => {
      await result.current.fetchRuns();
    });

    expect(getRuns).not.toHaveBeenCalled();
    expect(result.current.runs).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('refresh clears runs then fetches again', async () => {
    getRuns
      .mockResolvedValueOnce({
        runs: [{ jobName: 'job-a', status: 'succeeded' }],
        total: 1,
      })
      .mockResolvedValueOnce({
        runs: [{ jobName: 'job-b', status: 'succeeded' }],
        total: 1,
      });

    const { result } = renderHook(() =>
      useRuns(entity as any, 'dev', 'project-a', options),
    );

    await act(async () => {
      await result.current.fetchRuns();
    });
    expect(result.current.runs[0].jobName).toBe('job-a');

    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => expect(getRuns).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.runs).toHaveLength(1));
    expect(result.current.runs[0].jobName).toBe('job-b');
  });

  it('stale-request guard: an older in-flight call cannot overwrite the newer result', async () => {
    // First call: never resolves within the test window.
    let resolveFirst!: (v: any) => void;
    const firstPromise = new Promise(resolve => {
      resolveFirst = resolve;
    });
    getRuns.mockReturnValueOnce(firstPromise);
    // Second call: resolves immediately with the "newer" data.
    getRuns.mockResolvedValueOnce({
      runs: [{ jobName: 'newer', status: 'succeeded' }],
      total: 1,
    });

    const { result } = renderHook(() =>
      useRuns(entity as any, 'dev', 'project-a', options),
    );

    // Kick off both fetches, then resolve the first one late.
    await act(async () => {
      // Fire the first (unresolved) fetch — do not await, or we'd deadlock.
      result.current.fetchRuns();
      // Fire the second fetch; this awaits and updates state to "newer".
      await result.current.fetchRuns();
    });

    expect(result.current.runs[0].jobName).toBe('newer');

    // Now resolve the older, in-flight first call — the guard must ignore it.
    await act(async () => {
      resolveFirst({
        runs: [{ jobName: 'older', status: 'succeeded' }],
        total: 99,
      });
      // Yield a microtask so any pending .then handlers run.
      await Promise.resolve();
    });

    expect(result.current.runs[0].jobName).toBe('newer');
    expect(result.current.totalCount).toBe(1);
  });
});
