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

/** Sentinel marking a component that has returned its last (short) page. */
const FANOUT_DONE = '__done__';

/** Per-component pagination cursor: componentName ('' for unfiltered) → its own
 *  last-returned timestamp, or FANOUT_DONE once that component is exhausted. */
type FanoutCursor = Record<string, string>;

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
    isRefetching,
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

      // The fan-out paginates each component INDEPENDENTLY: the cursor is a
      // per-component map of that component's own last-returned timestamp (or
      // FANOUT_DONE once it returned a short page). A single shared merged-page
      // cursor would skip a lagging component's rows and duplicate the leading
      // component's, since each component's window edge differs. Page 1 (no
      // cursor) queries every component over the full range.
      const perCursor: FanoutCursor = cursor ? JSON.parse(cursor) : {};

      const componentsForPage =
        selectedComponents.length > 0 ? selectedComponents : [undefined];

      const perComponent = await Promise.all(
        componentsForPage.map(async componentName => {
          const key = componentName ?? '';
          const state = perCursor[key];
          // A component that already returned a short page is exhausted — skip
          // it on subsequent pages so it can't be re-queried or duplicated.
          if (state === FANOUT_DONE) {
            return { componentName, logs: [] as LogEntry[], total: 0 };
          }
          const startTime =
            sortOrder === 'asc' && state ? state : initialStartTime;
          const endTime =
            sortOrder === 'desc' && state ? state : initialEndTime;
          const response = await observabilityApi.getRuntimeLogs(
            options.namespaceName,
            options.projectName,
            options.environmentName,
            componentName,
            {
              limit: pageSize,
              startTime,
              endTime,
              logLevels,
              searchQuery: filters.searchQuery,
              sortOrder,
            },
          );
          const logs = (response.logs || []).map(log => ({
            ...log,
            metadata: {
              ...log.metadata,
              componentName:
                log.metadata?.componentName || componentName || undefined,
            },
          }));
          return { componentName, logs, total: response.total ?? 0 };
        }),
      );

      // Build the next per-component cursor: a component that filled its page
      // advances to its own last timestamp; a short page marks it done.
      const nextCursor: FanoutCursor = {};
      let anyMore = false;
      for (const { componentName, logs } of perComponent) {
        const key = componentName ?? '';
        const prev = perCursor[key];
        if (prev === FANOUT_DONE) {
          nextCursor[key] = FANOUT_DONE;
        } else if (logs.length === pageSize) {
          nextCursor[key] = logs[logs.length - 1].timestamp ?? FANOUT_DONE;
          if (nextCursor[key] !== FANOUT_DONE) anyMore = true;
        } else {
          nextCursor[key] = FANOUT_DONE;
        }
      }

      const flattened = perComponent.flatMap(r => r.logs);
      return {
        items: sortByTimestamp(flattened, sortOrder),
        total: perComponent.reduce((sum, r) => sum + r.total, 0),
        hasMore: anyMore,
        // Carry the per-component cursor forward for the next loadMore.
        nextCursor: anyMore ? JSON.stringify(nextCursor) : undefined,
      };
    },
    {
      pageSize,
      // The per-component cursor is computed in the fetcher and returned as
      // `nextCursor`; getCursor just surfaces it (falling back to the last
      // timestamp for the single-component / unfiltered case where there's no map).
      getCursor: (_last, page) => page?.nextCursor ?? null,
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
    isRefetching,
    error: error ? error.message || 'Failed to fetch logs' : null,
    totalCount,
    hasMore,
    fetchLogs: () => refresh(),
    loadMore,
    refresh,
    clearLogs: refresh,
  };
}
