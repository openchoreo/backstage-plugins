import { act, renderHook } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { usePodLogs } from './usePodLogs';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('usePodLogs', () => {
  const getPodLogs = jest.fn();

  const baseOptions = {
    podName: 'pod-1',
    namespaceName: 'dev',
    projectName: 'project-a',
    environmentName: 'development',
    componentName: 'component-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getPodLogs });
  });

  it('starts with empty logs, no loading, no error', () => {
    const { result } = renderHook(() => usePodLogs(baseOptions));

    expect(result.current.logs).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does NOT call the API when podName is empty', async () => {
    const { result } = renderHook(() =>
      usePodLogs({ ...baseOptions, podName: '' }),
    );

    await act(async () => {
      await result.current.fetchLogs();
    });

    expect(getPodLogs).not.toHaveBeenCalled();
    expect(result.current.logs).toEqual([]);
  });

  it('does NOT call the API when componentName is empty', async () => {
    const { result } = renderHook(() =>
      usePodLogs({ ...baseOptions, componentName: '' }),
    );

    await act(async () => {
      await result.current.fetchLogs();
    });

    expect(getPodLogs).not.toHaveBeenCalled();
  });

  it('fetchLogs populates logs on success', async () => {
    getPodLogs.mockResolvedValueOnce({
      logs: [{ timestamp: 't1', body: 'hello' }],
      totalCount: 1,
    });

    const { result } = renderHook(() =>
      usePodLogs({
        ...baseOptions,
        startTime: '2026-03-05T09:00:00.000Z',
        endTime: '2026-03-05T10:00:00.000Z',
      }),
    );

    await act(async () => {
      await result.current.fetchLogs();
    });

    expect(getPodLogs).toHaveBeenCalledWith(
      'pod-1',
      'dev',
      'project-a',
      'development',
      'component-a',
      {
        startTime: '2026-03-05T09:00:00.000Z',
        endTime: '2026-03-05T10:00:00.000Z',
        limit: 500,
        sortOrder: 'asc',
      },
    );
    expect(result.current.logs).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('passes undefined time bounds when caller does not provide them', async () => {
    getPodLogs.mockResolvedValueOnce({ logs: [] });

    const { result } = renderHook(() => usePodLogs(baseOptions));

    await act(async () => {
      await result.current.fetchLogs();
    });

    expect(getPodLogs).toHaveBeenCalledWith(
      'pod-1',
      'dev',
      'project-a',
      'development',
      'component-a',
      {
        startTime: undefined,
        endTime: undefined,
        limit: 500,
        sortOrder: 'asc',
      },
    );
  });

  it('sets error state when the API rejects with an Error', async () => {
    getPodLogs.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => usePodLogs(baseOptions));

    await act(async () => {
      await result.current.fetchLogs();
    });

    expect(result.current.error).toBe('boom');
    expect(result.current.logs).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('uses a generic error message for non-Error rejections', async () => {
    getPodLogs.mockRejectedValueOnce('unknown');

    const { result } = renderHook(() => usePodLogs(baseOptions));

    await act(async () => {
      await result.current.fetchLogs();
    });

    expect(result.current.error).toBe('Failed to fetch logs');
  });

  it('stale-request guard: an older in-flight call cannot overwrite the newer result', async () => {
    let resolveFirst!: (v: any) => void;
    const firstPromise = new Promise(resolve => {
      resolveFirst = resolve;
    });
    getPodLogs.mockReturnValueOnce(firstPromise);
    getPodLogs.mockResolvedValueOnce({
      logs: [{ timestamp: 't2', body: 'newer' }],
    });

    const { result } = renderHook(() => usePodLogs(baseOptions));

    await act(async () => {
      result.current.fetchLogs();
      await result.current.fetchLogs();
    });

    expect(result.current.logs).toEqual([{ timestamp: 't2', body: 'newer' }]);

    await act(async () => {
      resolveFirst({ logs: [{ timestamp: 't1', body: 'older' }] });
      await Promise.resolve();
    });

    expect(result.current.logs).toEqual([{ timestamp: 't2', body: 'newer' }]);
  });
});
