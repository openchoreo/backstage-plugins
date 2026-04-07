import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { calculateTimeRange } from '@openchoreo/backstage-plugin-react';
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
): LogEntry[] => {
  const sorted = [...logs].sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
  });

  return sorted;
};

export function useProjectRuntimeLogs(
  filters: ProjectRuntimeLogsFilters,
  _entity: Entity,
  options: UseProjectRuntimeLogsOptions,
): UseProjectRuntimeLogsResult {
  const observabilityApi = useApi(observabilityApiRef);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const logsRef = useRef<LogEntry[]>([]);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  const selectedComponents = useMemo(
    () => Array.from(new Set(filters.components || [])),
    [filters.components],
  );

  const fetchLogs = useCallback(
    async (reset: boolean = false) => {
      if (
        !filters.environment ||
        !options.environmentName ||
        !options.namespaceName ||
        !options.projectName
      ) {
        return;
      }

      if (inFlightRef.current) {
        return;
      }

      try {
        inFlightRef.current = true;
        setLoading(true);
        setError(null);

        const { startTime: initialStartTime, endTime: initialEndTime } =
          calculateTimeRange(filters.timeRange);

        let startTime = initialStartTime;
        let endTime = initialEndTime;
        const sortOrder = filters.sortOrder || 'asc';

        if (!reset && logsRef.current.length > 0) {
          const lastLog = logsRef.current[logsRef.current.length - 1];
          if (sortOrder === 'desc') {
            endTime = lastLog.timestamp || endTime;
          } else {
            startTime = lastLog.timestamp || startTime;
          }
        }

        const limit = options.limit || 50;

        // If all log levels are selected, pass an empty array to reduce search complexity on the backend
        const queryOptions = {
          limit,
          startTime,
          endTime,
          logLevels:
            filters.logLevel.length === LOG_LEVELS.length &&
            LOG_LEVELS.every(l => filters.logLevel.includes(l))
              ? []
              : filters.logLevel,
          searchQuery: filters.searchQuery,
          sortOrder,
        } as const;

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

        const flattenedLogs =
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

        const mergedLogs = sortByTimestamp(flattenedLogs, sortOrder);

        const nextLogs = reset
          ? mergedLogs
          : sortByTimestamp([...logsRef.current, ...mergedLogs], sortOrder);

        setLogs(nextLogs);
        if (reset) {
          const total = responses.reduce((sum, response) => {
            return sum + (response.total || 0);
          }, 0);
          setTotalCount(total);
        }
        setHasMore(
          responses.some(response => (response.logs || []).length === limit),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      } finally {
        setLoading(false);
        inFlightRef.current = false;
      }
    },
    [
      filters.environment,
      filters.timeRange,
      filters.logLevel,
      filters.searchQuery,
      filters.sortOrder,
      observabilityApi,
      options.environmentName,
      options.namespaceName,
      options.projectName,
      options.limit,
      selectedComponents,
    ],
  );

  useEffect(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (
      !filters.isLive ||
      !filters.environment ||
      !options.environmentName ||
      !options.namespaceName ||
      !options.projectName
    ) {
      return undefined;
    }

    pollingIntervalRef.current = setInterval(() => {
      fetchLogs(true);
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      inFlightRef.current = false;
    };
  }, [
    fetchLogs,
    filters.environment,
    filters.isLive,
    options.environmentName,
    options.namespaceName,
    options.projectName,
  ]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore && !error && logs.length > 0) {
      fetchLogs(false);
    }
  }, [loading, hasMore, error, logs.length, fetchLogs]);

  const refresh = useCallback(() => {
    setLogs([]);
    fetchLogs(true);
  }, [fetchLogs]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    setTotalCount(0);
    setHasMore(true);
  }, []);

  return {
    logs,
    loading,
    error,
    totalCount,
    hasMore,
    fetchLogs,
    loadMore,
    refresh,
    clearLogs,
  };
}
