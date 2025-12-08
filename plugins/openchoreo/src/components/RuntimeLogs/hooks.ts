import { useCallback, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
          environmentName: selectedEnvironment.name,
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

const DEFAULT_TIME_RANGE = '1h';

interface UseUrlFiltersOptions {
  /** Available environments to map IDs to objects */
  environments: Environment[];
}

/**
 * Hook for managing runtime logs filters synced to URL query parameters.
 *
 * Query parameters:
 * - `env`: Environment ID
 * - `timeRange`: Time range value (defaults to '1h')
 * - `logLevel`: Comma-separated log levels
 *
 * @example
 * ```tsx
 * const { filters, updateFilters, resetFilters } = useUrlFilters({
 *   environments,
 * });
 * ```
 */
export function useUrlFilters({ environments }: UseUrlFiltersOptions) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL
  const filters = useMemo<RuntimeLogsFilters>(() => {
    const envId = searchParams.get('env');
    const timeRange = searchParams.get('timeRange') || DEFAULT_TIME_RANGE;
    const logLevelParam = searchParams.get('logLevel');
    const logLevel = logLevelParam
      ? logLevelParam.split(',').filter(Boolean)
      : [];

    // Parse selectedFields from URL
    const fieldsParam = searchParams.get('fields');
    let selectedFields: LogEntryField[];
    if (fieldsParam) {
      selectedFields = fieldsParam
        .split(',')
        .filter(f => Object.values(LogEntryField).includes(f as LogEntryField))
        .map(f => f as LogEntryField);
      // Ensure Log field is always included
      if (!selectedFields.includes(LogEntryField.Log)) {
        selectedFields.push(LogEntryField.Log);
      }
    } else {
      // Default to just Log field
      selectedFields = [LogEntryField.Log];
    }

    // Find environment by ID
    const environment = envId
      ? environments.find(e => e.id === envId)
      : undefined;

    return {
      environmentId: environment?.id || '',
      timeRange,
      logLevel,
      selectedFields,
    };
  }, [searchParams, environments]);

  // Auto-select first environment if none in URL and environments are loaded
  useEffect(() => {
    if (environments.length > 0 && !searchParams.get('env')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('env', environments[0].id);
      setSearchParams(newParams, { replace: true });
    }
  }, [environments, searchParams, setSearchParams]);

  // Update URL when filters change
  const updateFilters = useCallback(
    (newFilters: Partial<RuntimeLogsFilters>) => {
      const newParams = new URLSearchParams(searchParams);

      if (newFilters.environmentId !== undefined) {
        if (newFilters.environmentId) {
          newParams.set('env', newFilters.environmentId);
        } else {
          newParams.delete('env');
        }
      }

      if (newFilters.timeRange !== undefined) {
        if (newFilters.timeRange === DEFAULT_TIME_RANGE) {
          // Default value - remove from URL
          newParams.delete('timeRange');
        } else {
          newParams.set('timeRange', newFilters.timeRange);
        }
      }

      if (newFilters.logLevel !== undefined) {
        if (newFilters.logLevel.length > 0) {
          newParams.set('logLevel', newFilters.logLevel.join(','));
        } else {
          newParams.delete('logLevel');
        }
      }

      if (newFilters.selectedFields !== undefined) {
        // Ensure Log field is always included
        let fields = newFilters.selectedFields;
        if (!fields.includes(LogEntryField.Log)) {
          fields = [...fields, LogEntryField.Log];
        }
        // Only store in URL if not just the default [Log] field
        if (fields.length === 1 && fields[0] === LogEntryField.Log) {
          newParams.delete('fields');
        } else {
          newParams.set('fields', fields.join(','));
        }
      }

      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Reset filters to defaults
  const resetFilters = useCallback(() => {
    const newParams = new URLSearchParams();
    if (environments.length > 0) {
      newParams.set('env', environments[0].id);
    }
    setSearchParams(newParams, { replace: true });
  }, [environments, setSearchParams]);

  return { filters, updateFilters, resetFilters };
}
