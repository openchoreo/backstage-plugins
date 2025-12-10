import { useCallback, useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { discoveryApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { useApi } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  getRuntimeLogs,
  getEnvironments,
  getComponentDetails,
  calculateTimeRange,
} from '../../api/runtimeLogs';
import {
  LogEntry,
  Environment,
  RuntimeLogsFilters,
  RuntimeLogsPagination,
  LogEntryField,
} from './types';

export function useEnvironments() {
  const { entity } = useEntity();
  const discovery = useApi(discoveryApiRef);
  const identity = useApi(identityApiRef);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnvironments = async () => {
      try {
        setLoading(true);
        setError(null);
        const envs = await getEnvironments(entity, discovery, identity);
        setEnvironments(envs);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch environments',
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEnvironments();
  }, [entity, discovery, identity]);

  return { environments, loading, error };
}

export function useRuntimeLogs(
  filters: RuntimeLogsFilters,
  pagination: RuntimeLogsPagination,
  environments: Environment[],
) {
  const { entity } = useEntity();
  const discovery = useApi(discoveryApiRef);
  const identity = useApi(identityApiRef);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [componentId, setComponentId] = useState<string | null>(null);

  useEffect(() => {
    const fetchComponentId = async () => {
      try {
        const componentDetails = await getComponentDetails(
          entity,
          discovery,
          identity,
        );
        setComponentId(componentDetails.uid || null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch component ID',
        );
      }
    };

    fetchComponentId();
  }, [entity, discovery, identity]);

  const fetchLogs = useCallback(
    async (reset: boolean = false) => {
      if (!filters.environmentId || !componentId) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const selectedEnvironment = environments.find(
          env => env.id === filters.environmentId,
        );
        if (!selectedEnvironment) {
          throw new Error('Selected environment not found');
        }

        const componentName =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
        if (!componentName) {
          throw new Error('Component name not found in entity annotations');
        }

        const { startTime, endTime: initialEndTime } = calculateTimeRange(
          filters.timeRange,
        );

        // Use timestamp-based pagination instead of offset
        let endTime = initialEndTime;
        if (!reset && logs.length > 0) {
          // For load more, use the timestamp of the last log as the new endTime
          // TODO: Modify accordingly when sorting filter is added
          const lastLog = logs[logs.length - 1];
          endTime = lastLog.timestamp;
        }

        const response = await getRuntimeLogs(entity, discovery, identity, {
          componentId,
          componentName,
          environmentId: filters.environmentId,
          environmentName: selectedEnvironment.resourceName,
          logLevels: filters.logLevel,
          startTime,
          endTime,
          limit: pagination.limit,
          offset: 0, // Backend doesn't respect offset, using timestamp-based pagination instead
        });

        if (reset) {
          setLogs(response.logs);
          setTotalCount(response.totalCount);
        } else {
          setLogs(prev => [...prev, ...response.logs]);
        }

        setHasMore(response.logs.length === pagination.limit);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      } finally {
        setLoading(false);
      }
    },
    [
      entity,
      discovery,
      identity,
      filters,
      pagination.limit,
      logs,
      componentId,
      environments,
    ],
  );

  const loadMore = useCallback(() => {
    if (!loading && hasMore && !error && logs.length > 0) {
      fetchLogs(false);
    }
  }, [fetchLogs, hasMore, loading, error, logs.length]);

  const refresh = useCallback(() => {
    setLogs([]);
    fetchLogs(true);
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    totalCount,
    hasMore,
    fetchLogs,
    loadMore,
    refresh,
  };
}

export function useFilters() {
  const [filters, setFilters] = useState<RuntimeLogsFilters>({
    logLevel: [],
    selectedFields: [LogEntryField.Log],
    environmentId: '',
    timeRange: '1h',
  });

  const updateFilters = useCallback(
    (newFilters: Partial<RuntimeLogsFilters>) => {
      setFilters(prev => {
        const updated = { ...prev, ...newFilters };

        // Ensure Log field is always included in selectedFields
        if (
          updated.selectedFields &&
          !updated.selectedFields.includes(LogEntryField.Log)
        ) {
          updated.selectedFields = [
            ...updated.selectedFields,
            LogEntryField.Log,
          ];
        }

        return updated;
      });
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters({
      logLevel: [],
      selectedFields: [LogEntryField.Log],
      environmentId: '',
      timeRange: '1h',
    });
  }, []);

  return { filters, updateFilters, resetFilters };
}
