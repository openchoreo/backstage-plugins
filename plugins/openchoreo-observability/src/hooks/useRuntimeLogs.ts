import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { LogEntry } from '../components/RuntimeLogs/types';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  calculateTimeRange,
  useOpenChoreoInfiniteQuery,
} from '@openchoreo/backstage-plugin-react';

export interface UseRuntimeLogsOptions {
  environment: string;
  timeRange: string;
  /** ISO start time, used when `timeRange === 'custom'` */
  customStartTime?: string;
  /** ISO end time, used when `timeRange === 'custom'` */
  customEndTime?: string;
  logLevels?: string[];
  limit?: number;
  searchQuery?: string;
  sortOrder?: 'asc' | 'desc';
  isLive?: boolean;
}

export interface UseRuntimeLogsResult {
  logs: LogEntry[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  fetchLogs: (reset?: boolean) => Promise<void>;
  loadMore: () => void;
  refresh: () => void;
  clearLogs: () => void;
}

/**
 * Hook for fetching runtime logs for a component.
 *
 * Cursor-paginated over timestamps: "load more" walks the window edge using the
 * last row's timestamp (as the new endTime when descending, startTime when
 * ascending). Live mode re-fetches from the first page every 5s.
 *
 * @param entity - The Backstage entity
 * @param namespaceName - Namespace name
 * @param project - Project name
 * @param options - Runtime logs options (environment, time range, log levels, etc.)
 * @returns Runtime logs data and control functions
 */
export function useRuntimeLogs(
  entity: Entity,
  namespaceName: string,
  project: string,
  options: UseRuntimeLogsOptions,
  /**
   * Consumer gate (e.g. logs-view permission). Folded into the query's
   * `enabled` so no request fires while the page's own preconditions are unmet,
   * preserving the old imperative "only fetch when allowed" flow. @default true
   */
  enabled: boolean = true,
): UseRuntimeLogsResult {
  const observabilityApi = useApi(observabilityApiRef);

  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const pageSize = options.limit || 50;
  const sortOrder = options.sortOrder || 'asc';
  // Empty (but defined) log levels means "none selected" → fetch nothing.
  const noLevelsSelected =
    options.logLevels !== undefined && options.logLevels.length === 0;

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
  } = useOpenChoreoInfiniteQuery<LogEntry>(
    [
      'runtime-logs',
      namespaceName,
      project,
      options.environment,
      componentName ?? null,
      options.timeRange,
      options.customStartTime,
      options.customEndTime,
      (options.logLevels ?? []).join(','),
      options.searchQuery ?? '',
      sortOrder,
      pageSize,
    ],
    async cursor => {
      const { startTime: initialStartTime, endTime: initialEndTime } =
        calculateTimeRange(options.timeRange, {
          startTime: options.customStartTime,
          endTime: options.customEndTime,
        });

      // The cursor is the previous page's last timestamp; move the matching
      // window edge inward based on sort order.
      let startTime = initialStartTime;
      let endTime = initialEndTime;
      if (cursor) {
        if (sortOrder === 'desc') endTime = cursor;
        else startTime = cursor;
      }

      const response = await observabilityApi.getRuntimeLogs(
        namespaceName,
        project,
        options.environment,
        componentName!,
        {
          limit: pageSize,
          startTime,
          endTime,
          logLevels: options.logLevels,
          searchQuery: options.searchQuery,
          sortOrder,
        },
      );
      return { items: response.logs, total: response.total ?? 0 };
    },
    {
      pageSize,
      getCursor: last => last.timestamp,
      enabled:
        enabled &&
        !!options.environment &&
        !!componentName &&
        !noLevelsSelected,
      refetchInterval: options.isLive ? 5000 : false,
    },
  );

  return {
    logs: items,
    loading: loading || loadingMore,
    isRefetching,
    error: error ? error.message || 'Failed to fetch logs' : null,
    totalCount,
    hasMore,
    // Kept for API compatibility; the query refetches on filter/key change.
    fetchLogs: async () => {
      refresh();
    },
    loadMore,
    refresh,
    // Clearing is a refresh back to page 1 now that pages live in the cache.
    clearLogs: refresh,
  };
}
