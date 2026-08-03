import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { LogEntryField, LOG_LEVELS } from '../components/RuntimeLogs/types';
import { useProjectRuntimeLogs } from './useProjectRuntimeLogs';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useProjectRuntimeLogs', () => {
  const getRuntimeLogs = jest.fn();

  const baseFilters = {
    environment: 'env-1',
    timeRange: '1h',
    // Non-empty logLevel is required for the query to be enabled under the new
    // declarative model (enabled: filters.logLevel.length > 0). All levels are
    // selected, which the hook still normalises to [] for the backend call.
    logLevel: [...LOG_LEVELS],
    selectedFields: [
      LogEntryField.Timestamp,
      LogEntryField.LogLevel,
      LogEntryField.Log,
    ],
    sortOrder: 'desc' as const,
    searchQuery: '',
    isLive: false,
  };

  const entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: 'project-a',
      annotations: { 'openchoreo.io/namespace': 'dev' },
    },
    spec: { owner: 'group:default/team' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({
      getRuntimeLogs,
    });
  });

  it('calls runtime logs API in parallel per selected component and merges by timestamp', async () => {
    getRuntimeLogs
      .mockResolvedValueOnce({
        logs: [
          {
            timestamp: '2026-03-05T10:00:00.000Z',
            log: 'comp-a older',
            level: 'INFO',
          },
          {
            timestamp: '2026-03-05T10:02:00.000Z',
            log: 'comp-a newer',
            level: 'INFO',
          },
        ],
        total: 2,
      })
      .mockResolvedValueOnce({
        logs: [
          {
            timestamp: '2026-03-05T10:01:00.000Z',
            log: 'comp-b middle',
            level: 'WARN',
          },
        ],
        total: 1,
      });

    const { result } = renderHook(
      () =>
        useProjectRuntimeLogs(
          {
            ...baseFilters,
            components: ['component-a', 'component-b'],
          },
          entity as any,
          {
            environmentName: 'development',
            namespaceName: 'dev',
            projectName: 'project-a',
            limit: 50,
          },
        ),
      { wrapper: createQueryWrapper() },
    );

    // Fan-out page auto-fetches on mount (replaces the old fetchLogs(true)).
    await waitFor(() => expect(result.current.logs).toHaveLength(3));

    expect(getRuntimeLogs).toHaveBeenCalledTimes(2);
    expect(getRuntimeLogs).toHaveBeenNthCalledWith(
      1,
      'dev',
      'project-a',
      'development',
      'component-a',
      expect.any(Object),
    );
    expect(getRuntimeLogs).toHaveBeenNthCalledWith(
      2,
      'dev',
      'project-a',
      'development',
      'component-b',
      expect.any(Object),
    );

    expect(result.current.logs.map(log => log.log)).toEqual([
      'comp-a newer',
      'comp-b middle',
      'comp-a older',
    ]);
    expect(result.current.logs.map(log => log.metadata?.componentName)).toEqual(
      ['component-a', 'component-b', 'component-a'],
    );
    expect(result.current.totalCount).toBe(3);
  });

  it('paginates each component with its OWN cursor and skips exhausted components on load more', async () => {
    // pageSize 2. Component A fills its page (2 rows) → has more; component B
    // returns a short page (1 row) → exhausted. The bug this guards: a single
    // merged-page cursor would re-request B from A's newer boundary (skipping
    // B rows) and re-request A's boundary row (duplicate). Per-component cursors
    // must advance A from A's own last timestamp and not re-query B at all.
    getRuntimeLogs
      // Page 1 — component A (desc): full page, newest first.
      .mockResolvedValueOnce({
        logs: [
          {
            timestamp: '2026-03-05T10:05:00.000Z',
            log: 'a-newer',
            level: 'INFO',
          },
          {
            timestamp: '2026-03-05T10:04:00.000Z',
            log: 'a-older',
            level: 'INFO',
          },
        ],
        total: 5,
      })
      // Page 1 — component B (desc): short page → exhausted.
      .mockResolvedValueOnce({
        logs: [
          {
            timestamp: '2026-03-05T10:03:00.000Z',
            log: 'b-only',
            level: 'WARN',
          },
        ],
        total: 1,
      })
      // Page 2 — ONLY component A should be re-queried, from A's own boundary.
      .mockResolvedValueOnce({
        logs: [
          {
            timestamp: '2026-03-05T10:02:00.000Z',
            log: 'a-page2',
            level: 'INFO',
          },
        ],
        total: 5,
      });

    const { result } = renderHook(
      () =>
        useProjectRuntimeLogs(
          { ...baseFilters, components: ['component-a', 'component-b'] },
          entity as any,
          {
            environmentName: 'development',
            namespaceName: 'dev',
            projectName: 'project-a',
            limit: 2,
          },
        ),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.logs).toHaveLength(3));
    expect(result.current.hasMore).toBe(true);

    result.current.loadMore();

    await waitFor(() => expect(result.current.logs).toHaveLength(4));

    // Exactly 3 calls total: A, B on page 1, and A ONLY on page 2 (B skipped).
    expect(getRuntimeLogs).toHaveBeenCalledTimes(3);
    // Page-2 call is component-a, windowed at A's OWN last timestamp (desc →
    // endTime = a-older's timestamp), NOT the merged boundary (b-only earlier).
    expect(getRuntimeLogs).toHaveBeenNthCalledWith(
      3,
      'dev',
      'project-a',
      'development',
      'component-a',
      expect.objectContaining({ endTime: '2026-03-05T10:04:00.000Z' }),
    );
    // No duplicate rows, no skipped B row.
    expect(result.current.logs.map(l => l.log)).toEqual([
      'a-newer',
      'a-older',
      'b-only',
      'a-page2',
    ]);
  });

  it('uses a single project-level API call when no components are selected', async () => {
    getRuntimeLogs.mockResolvedValueOnce({
      logs: [
        {
          timestamp: '2026-03-05T10:02:00.000Z',
          log: 'project-wide',
          level: 'INFO',
        },
      ],
      total: 1,
    });

    const { result } = renderHook(
      () =>
        useProjectRuntimeLogs(
          {
            ...baseFilters,
            components: [],
          },
          entity as any,
          {
            environmentName: 'development',
            namespaceName: 'dev',
            projectName: 'project-a',
            limit: 50,
          },
        ),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.logs).toHaveLength(1));

    expect(getRuntimeLogs).toHaveBeenCalledTimes(1);
    expect(getRuntimeLogs).toHaveBeenCalledWith(
      'dev',
      'project-a',
      'development',
      undefined,
      expect.any(Object),
    );
    expect(result.current.totalCount).toBe(1);
  });
});
