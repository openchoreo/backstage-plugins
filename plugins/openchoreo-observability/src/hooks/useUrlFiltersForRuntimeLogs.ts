import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Environment,
  RuntimeLogsFilters,
  LogEntryField,
  SELECTED_FIELDS,
} from '../components/RuntimeLogs/types';

const DEFAULT_TIME_RANGE = '1h';

interface UseUrlFiltersForRuntimeLogsOptions {
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
 * const { filters, updateFilters, resetFilters } = useUrlFiltersForRuntimeLogs({
 *   environments,
 * });
 * ```
 */
export function useUrlFiltersForRuntimeLogs({
  environments,
}: UseUrlFiltersForRuntimeLogsOptions) {
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
      // Sort by the order of the SELECTED_FIELDS array to maintain consistent column order
      selectedFields = SELECTED_FIELDS.filter(field =>
        selectedFields.includes(field),
      );
    } else {
      // Default to Timestamp and Log fields
      selectedFields = [LogEntryField.Timestamp, LogEntryField.Log];
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
        // Only store in URL if not the default [Timestamp, Log] fields
        const isDefaultFields =
          fields.length === 2 &&
          fields.includes(LogEntryField.Log) &&
          fields.includes(LogEntryField.Timestamp);
        if (isDefaultFields) {
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
