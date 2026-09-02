import { useApi } from '@backstage/core-plugin-api';
import {
  calculateTimeRange,
  useOpenChoreoInfiniteQuery,
} from '@openchoreo/backstage-plugin-react';
import { observabilityApiRef } from '../api/ObservabilityApi';
import {
  PLATFORM_LOG_LEVELS,
  PlatformLogEntry,
  PlatformLogsFilters,
} from '../components/PlatformLogs/types';

/** Poll interval while tailing, matched to the component logs page. */
const LIVE_POLL_MS = 5000;

export interface UsePlatformLogsResult {
  logs: PlatformLogEntry[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

/**
 * Fetches platform (system component) logs from one observability plane.
 *
 * Cursor-paginated over timestamps, the same way component logs are: "load more" walks
 * the window edge using the last row's timestamp as the new endTime when descending, or
 * startTime when ascending. There is no facet endpoint in v1, so the filter pickers are
 * free-text and this hook simply forwards whatever they hold.
 */
export function usePlatformLogs(
  observerUrl: string | undefined,
  filters: PlatformLogsFilters,
  pageSize: number = 50,
  enabled: boolean = true,
): UsePlatformLogsResult {
  const observabilityApi = useApi(observabilityApiRef);

  const sortOrder = filters.sortOrder ?? 'desc';
  // All levels selected is the same query as no level filter, so send nothing and keep
  // the URL and the request shorter. None selected means the operator has filtered
  // everything out; the query is disabled rather than sent.
  const allLevels = filters.logLevel.length === PLATFORM_LOG_LEVELS.length;
  const noLevels = filters.logLevel.length === 0;
  const logLevels = allLevels ? undefined : filters.logLevel;

  const {
    items,
    loading,
    isRefetching,
    loadingMore,
    error,
    totalCount,
    hasMore,
    loadMore,
    refresh,
  } = useOpenChoreoInfiniteQuery<PlatformLogEntry>(
    [
      'platform-logs',
      observerUrl ?? '',
      filters.clusterInstances.join(','),
      filters.namespaces.join(','),
      filters.podNames.join(','),
      filters.containerNames.join(','),
      filters.labels,
      (logLevels ?? []).join(','),
      filters.timeRange,
      filters.customStartTime,
      filters.customEndTime,
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

      const response = await observabilityApi.getPlatformLogs(observerUrl!, {
        clusterInstances: filters.clusterInstances,
        namespaces: filters.namespaces,
        podNames: filters.podNames,
        containerNames: filters.containerNames,
        labels: filters.labels || undefined,
        logLevels,
        searchQuery: filters.searchQuery,
        startTime,
        endTime,
        limit: pageSize,
        sortOrder,
      });
      return { items: response.logs, total: response.total ?? 0 };
    },
    {
      pageSize,
      getCursor: last => last.timestamp,
      enabled: enabled && !!observerUrl && !noLevels,
      // Tailing re-runs the first page. A relative range recomputes its window each
      // time, so new entries arrive; the URL layer already refuses to set this on a
      // custom range, where the window is fixed and polling would return the same rows.
      refetchInterval: filters.isLive ? LIVE_POLL_MS : false,
    },
  );

  return {
    logs: items,
    loading: loading || loadingMore,
    isRefetching,
    error: error ? error.message || 'Failed to fetch platform logs' : null,
    totalCount,
    hasMore,
    loadMore,
    refresh,
  };
}
