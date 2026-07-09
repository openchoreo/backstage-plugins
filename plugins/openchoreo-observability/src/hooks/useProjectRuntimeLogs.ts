import { useMemo } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { observabilityApiRef } from '../api/ObservabilityApi';
import {
  calculateTimeRange,
  useOpenChoreoInfiniteQuery,
} from '@openchoreo/backstage-plugin-react';
import {
  LogEntry,
  LogsResponse,
  RuntimeLogsFilters,
  LOG_LEVELS,
} from '../components/RuntimeLogs/types';

export interface ProjectRuntimeLogsFilters extends RuntimeLogsFilters {
  components?: string[];
}

interface UseProjectRuntimeLogsOptions {
  environmentName: string;
  namespaceName: string;
  projectName: string;
  limit?: number;
}

interface UseProjectRuntimeLogsResult {
  logs: LogEntry[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  fetchLogs: (reset?: boolean) => Promise<void>;
  loadMore: () => void;
  refresh: () => void;
  clearLogs: () => void;
}

const sortByTimestamp = (
  logs: LogEntry[],
  sortOrder: 'asc' | 'desc' = 'asc',
): LogEntry[] =>
  [...logs].sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
  });

export function useProjectRuntimeLogs(
  filters: ProjectRuntimeLogsFilters,
  _entity: Entity,
  options: UseProjectRuntimeLogsOptions,
  /** Consumer gate (e.g. logs-view permission). Folded into `enabled`. @default true */
  enabled: boolean = true,
): UseProjectRuntimeLogsResult {
  const observabilityApi = useApi(observabilityApiRef);

  const selectedComponents = useMemo(
    () => Array.from(new Set(filters.components || [])),
    [filters.components],
  );

  const pageSize = options.limit || 50;
  const sortOrder = filters.sortOrder || 'asc';
  // All levels selected → pass [] to reduce backend search complexity.
  const logLevels =
    filters.logLevel.length === LOG_LEVELS.length &&
    LOG_LEVELS.every(l => filters.logLevel.includes(l))
      ? []
      : filters.logLevel;

  const {
    items,
    loading,
    loadingMore,
    error,
    totalCount,
    hasMore,
    loadMore,
    refresh,
  } = useOpenChoreoInfiniteQuery<LogEntry>(
    [
      'project-runtime-logs',
      options.namespaceName,
      options.projectName,
      options.environmentName,
      selectedComponents.join(','),
      filters.timeRange,
      filters.customStartTime,
      filters.customEndTime,
      logLevels.join(','),
      filters.searchQuery ?? '',
      sortOrder,
      pageSize,
    ],
    async cursor => {
      const { startTime: initialStartTime, endTime: initialEndTime } =
        calculateTimeRange(filters.timeRange, {
          startTime: filters.customStartTime,
          endTime: filters.customEndTime,
        });

      let startTime = initialStartTime;
      let endTime = initialEndTime;
      if (cursor) {
        if (sortOrder === 'desc') endTime = cursor;
        else startTime = cursor;
      }

      const queryOptions = {
        limit: pageSize,
        startTime,
        endTime,
        logLevels,
        searchQuery: filters.searchQuery,
        sortOrder,
      } as const;

      // Fan out one request per selected component (or one unfiltered request),
      // then merge + re-sort into a single page.
      const responses: LogsResponse[] =
        selectedComponents.length > 0
          ? await Promise.all(
              selectedComponents.map(componentName =>
                observabilityApi.getRuntimeLogs(
                  options.namespaceName,
                  options.projectName,
                  options.environmentName,
                  componentName,
                  queryOptions,
                ),
              ),
            )
          : [
              await observabilityApi.getRuntimeLogs(
                options.namespaceName,
                options.projectName,
                options.environmentName,
                undefined,
                queryOptions,
              ),
            ];

      const flattened =
        selectedComponents.length > 0
          ? responses.flatMap((response, index) =>
              (response.logs || []).map(log => ({
                ...log,
                metadata: {
                  ...log.metadata,
                  componentName:
                    log.metadata?.componentName || selectedComponents[index],
                },
              })),
            )
          : responses.flatMap(response => response.logs || []);

      return {
        items: sortByTimestamp(flattened, sortOrder),
        total: responses.reduce((sum, r) => sum + (r.total || 0), 0),
        // A merged page can exceed pageSize, so length isn't a clean end signal:
        // more pages exist if ANY component filled its page.
        hasMore: responses.some(r => (r.logs || []).length === pageSize),
      };
    },
    {
      pageSize,
      getCursor: last => last.timestamp,
      enabled:
        enabled &&
        filters.logLevel.length > 0 &&
        !!filters.environment &&
        !!options.environmentName &&
        !!options.namespaceName &&
        !!options.projectName,
      refetchInterval: filters.isLive ? 5000 : false,
    },
  );

  return {
    logs: items,
    loading: loading || loadingMore,
    error: error ? error.message || 'Failed to fetch logs' : null,
    totalCount,
    hasMore,
    fetchLogs: async () => {
      refresh();
    },
    loadMore,
    refresh,
    clearLogs: refresh,
  };
}
