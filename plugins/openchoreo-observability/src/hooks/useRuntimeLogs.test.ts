import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useRuntimeLogs } from './useRuntimeLogs';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useRuntimeLogs', () => {
  const getRuntimeLogs = jest.fn();

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
    environment: 'development',
    timeRange: '1h',
    sortOrder: 'asc' as const,
    limit: 50,
  };

  const makeLog = (timestamp: string, log: string) => ({
    timestamp,
    log,
    level: 'INFO',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getRuntimeLogs });
  });

  it('starts in loading state with empty logs', () => {
    getRuntimeLogs.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(
      () => useRuntimeLogs(entity as any, 'dev', 'project-a', options),
      { wrapper: createQueryWrapper() },
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.logs).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('resolves logs, total count and hasMore, clears loading/error once settled', async () => {
    getRuntimeLogs.mockResolvedValueOnce({
      logs: [
        makeLog('2026-03-05T10:00:00.000Z', 'first'),
        makeLog('2026-03-05T10:01:00.000Z', 'second'),
      ],
      total: 2,
    });

    const { result } = renderHook(
      () => useRuntimeLogs(entity as any, 'dev', 'project-a', options),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getRuntimeLogs).toHaveBeenCalledWith(
      'dev',
      'project-a',
      'development',
      'component-a',
      expect.any(Object),
    );
    expect(result.current.logs.map(l => l.log)).toEqual(['first', 'second']);
    expect(result.current.totalCount).toBe(2);
    // A short page (2 rows < pageSize 50) means no further pages.
    expect(result.current.hasMore).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('exposes isRefetching, false once the load settles', async () => {
    getRuntimeLogs.mockResolvedValueOnce({ logs: [], total: 0 });

    const { result } = renderHook(
      () => useRuntimeLogs(entity as any, 'dev', 'project-a', options),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isRefetching).toBe(false);
  });
});
