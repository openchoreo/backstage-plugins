import { act, renderHook } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { LogEntryField } from '../components/RuntimeLogs/types';
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
    logLevel: [],
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

    const { result } = renderHook(() =>
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
    );

    await act(async () => {
      await result.current.fetchLogs(true);
    });

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

    const { result } = renderHook(() =>
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
    );

    await act(async () => {
      await result.current.fetchLogs(true);
    });

    expect(getRuntimeLogs).toHaveBeenCalledTimes(1);
    expect(getRuntimeLogs).toHaveBeenCalledWith(
      'dev',
      'project-a',
      'development',
      undefined,
      expect.any(Object),
    );
    expect(result.current.logs).toHaveLength(1);
    expect(result.current.totalCount).toBe(1);
  });
});
