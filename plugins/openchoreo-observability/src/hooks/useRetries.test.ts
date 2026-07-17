import { act, renderHook } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { useRetries } from './useRetries';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useRetries', () => {
  const getRetries = jest.fn();

  const baseOptions = {
    jobName: 'job-1',
    namespaceName: 'dev',
    projectName: 'project-a',
    environmentName: 'development',
    componentName: 'component-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getRetries });
  });

  it('starts with empty retries, no loading, no error', () => {
    const { result } = renderHook(() => useRetries(baseOptions));

    expect(result.current.retries).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does NOT call the API when jobName is empty', async () => {
    const { result } = renderHook(() =>
      useRetries({ ...baseOptions, jobName: '' }),
    );

    await act(async () => {
      await result.current.fetchRetries();
    });

    expect(getRetries).not.toHaveBeenCalled();
  });

  it('does NOT call the API when namespaceName is empty', async () => {
    const { result } = renderHook(() =>
      useRetries({ ...baseOptions, namespaceName: '' }),
    );

    await act(async () => {
      await result.current.fetchRetries();
    });

    expect(getRetries).not.toHaveBeenCalled();
  });

  it('calls the API WITH both time bounds when both are provided', async () => {
    getRetries.mockResolvedValueOnce({
      retries: [
        {
          podName: 'pod-1',
          status: 'Succeeded',
          startTime: '2026-03-05T10:00:00.000Z',
          eventCount: 1,
        },
      ],
      total: 1,
    });

    const { result } = renderHook(() =>
      useRetries({
        ...baseOptions,
        startTime: '2026-03-05T09:00:00.000Z',
        endTime: '2026-03-05T10:00:00.000Z',
      }),
    );

    await act(async () => {
      await result.current.fetchRetries();
    });

    expect(getRetries).toHaveBeenCalledWith(
      'job-1',
      'dev',
      'project-a',
      'development',
      'component-a',
      {
        startTime: '2026-03-05T09:00:00.000Z',
        endTime: '2026-03-05T10:00:00.000Z',
      },
    );
    expect(result.current.retries).toHaveLength(1);
    expect(result.current.retries[0].podName).toBe('pod-1');
  });

  it('calls the API WITHOUT time bounds when only startTime is provided', async () => {
    getRetries.mockResolvedValueOnce({ retries: [], total: 0 });

    const { result } = renderHook(() =>
      useRetries({
        ...baseOptions,
        startTime: '2026-03-05T09:00:00.000Z',
      }),
    );

    await act(async () => {
      await result.current.fetchRetries();
    });

    expect(getRetries).toHaveBeenCalledWith(
      'job-1',
      'dev',
      'project-a',
      'development',
      'component-a',
      undefined,
    );
  });

  it('calls the API WITHOUT time bounds when only endTime is provided', async () => {
    getRetries.mockResolvedValueOnce({ retries: [], total: 0 });

    const { result } = renderHook(() =>
      useRetries({
        ...baseOptions,
        endTime: '2026-03-05T10:00:00.000Z',
      }),
    );

    await act(async () => {
      await result.current.fetchRetries();
    });

    expect(getRetries).toHaveBeenCalledWith(
      'job-1',
      'dev',
      'project-a',
      'development',
      'component-a',
      undefined,
    );
  });

  it('calls the API WITHOUT time bounds when neither is provided', async () => {
    getRetries.mockResolvedValueOnce({ retries: [], total: 0 });

    const { result } = renderHook(() => useRetries(baseOptions));

    await act(async () => {
      await result.current.fetchRetries();
    });

    expect(getRetries).toHaveBeenCalledWith(
      'job-1',
      'dev',
      'project-a',
      'development',
      'component-a',
      undefined,
    );
  });

  it('sets error state when the API rejects with an Error', async () => {
    getRetries.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useRetries(baseOptions));

    await act(async () => {
      await result.current.fetchRetries();
    });

    expect(result.current.error).toBe('boom');
    expect(result.current.retries).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('uses a generic error message for non-Error rejections', async () => {
    getRetries.mockRejectedValueOnce('unknown');

    const { result } = renderHook(() => useRetries(baseOptions));

    await act(async () => {
      await result.current.fetchRetries();
    });

    expect(result.current.error).toBe('Failed to fetch retries');
  });

  it('stale-request guard: an older in-flight call cannot overwrite the newer result', async () => {
    let resolveFirst!: (v: any) => void;
    const firstPromise = new Promise(resolve => {
      resolveFirst = resolve;
    });
    getRetries.mockReturnValueOnce(firstPromise);
    getRetries.mockResolvedValueOnce({
      retries: [{ podName: 'newer', status: 'Succeeded' }],
      total: 1,
    });

    const { result } = renderHook(() => useRetries(baseOptions));

    await act(async () => {
      result.current.fetchRetries();
      await result.current.fetchRetries();
    });

    expect(result.current.retries[0].podName).toBe('newer');

    await act(async () => {
      resolveFirst({
        retries: [{ podName: 'older', status: 'Succeeded' }],
        total: 99,
      });
      await Promise.resolve();
    });

    expect(result.current.retries[0].podName).toBe('newer');
  });
});
