import { useCallback, useEffect, useState, useRef } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Entity } from '@backstage/catalog-model';
import { LogEntry } from '../components/RuntimeLogs/types';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { calculateTimeRange } from '@openchoreo/backstage-plugin-react';

export interface UseRuntimeLogsOptions {
  environment: string;
  timeRange: string;
  logLevels?: string[];
  limit?: number;
  searchQuery?: string;
  sortOrder?: 'asc' | 'desc';
  isLive?: boolean;
}

export interface UseRuntimeLogsResult {
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

/**
 * Hook for fetching runtime logs for a component.
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
): UseRuntimeLogsResult {
  const observabilityApi = useApi(observabilityApiRef);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const fetchGenerationRef = useRef<number>(0);

  const fetchLogs = useCallback(
    async (reset: boolean = false) => {
      if (!options.environment) {
        return;
      }

      // Skip fetch if logLevels is explicitly empty (none selected)
      if (options.logLevels !== undefined && options.logLevels.length === 0) {
        return;
      }

      // Check if a fetch is already in progress
      if (inFlightRef.current) {
        return;
      }

      const generation = fetchGenerationRef.current;

      try {
        inFlightRef.current = true;
        setLoading(true);
        setError(null);

        const componentName =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
        if (!componentName) {
          throw new Error('Component name not found in entity annotations');
        }

        // Calculate the start and end times based on the time range
        const { startTime: initialStartTime, endTime: initialEndTime } =
          calculateTimeRange(options.timeRange);

        // Use timestamp-based pagination instead of offset
        let endTime = initialEndTime;
        let startTime = initialStartTime;
        if (!reset && logs.length > 0) {
          // For load more, use the timestamp of the last log as the new endTime or startTime based on the sort order
          const lastLog = logs[logs.length - 1];
          const sortOrder = options.sortOrder || 'asc';
          if (sortOrder === 'desc') {
            // For descending (newest first), use the timestamp of the last log as the new endTime
            endTime = lastLog.timestamp ?? endTime;
          } else {
            // For ascending (oldest first), use the timestamp of the last log as the new startTime
            startTime = lastLog.timestamp ?? startTime;
          }
        }

        const response = await observabilityApi.getRuntimeLogs(
          namespaceName,
          project,
          options.environment,
          componentName,
          {
            limit: options.limit || 50,
            startTime,
            endTime,
            logLevels: options.logLevels,
            searchQuery: options.searchQuery,
            sortOrder: options.sortOrder || 'asc',
          },
        );

        if (fetchGenerationRef.current !== generation) return;

        if (reset) {
          setLogs(response.logs);
          setTotalCount(response.total ?? 0);
        } else {
          setLogs(prev => [...prev, ...response.logs]);
        }

        setHasMore(response.logs.length === (options.limit || 50));
      } catch (err) {
        if (fetchGenerationRef.current === generation) {
          setError(err instanceof Error ? err.message : 'Failed to fetch logs');
        }
      } finally {
        setLoading(false);
        inFlightRef.current = false;
      }
    },
    [
      observabilityApi,
      options.environment,
      options.timeRange,
      options.logLevels,
      options.limit,
      options.searchQuery,
      options.sortOrder,
      logs,
      namespaceName,
      project,
      entity,
    ],
  );

  // Live polling effect
  useEffect(() => {
    // Always clear any existing interval first
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (!options.isLive) {
      return undefined;
    }

    // Set up polling interval (5 seconds)
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
  }, [options.isLive, fetchLogs]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore && !error && logs.length > 0) {
      fetchLogs(false);
    }
  }, [fetchLogs, hasMore, loading, error, logs.length]);

  const refresh = useCallback(() => {
    setLogs([]);
    fetchLogs(true);
  }, [fetchLogs]);

  const clearLogs = useCallback(() => {
    fetchGenerationRef.current += 1;
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
