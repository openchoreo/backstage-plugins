import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  RuntimeLogsFilters,
  LogEntryField,
  LOG_LEVELS,
  SELECTED_FIELDS,
} from '../components/RuntimeLogs/types';
import type { Environment } from '../types';
import { useAutoSelectFirstEnvironment } from './useAutoSelectFirstEnvironment';

const DEFAULT_TIME_RANGE = '10m';

interface UseUrlFiltersForRuntimeLogsOptions {
  /** Available environments to map envName from URL */
  environments: Environment[];
}

/**
 * Hook for managing runtime logs filters synced to URL query parameters.
 *
 * Query parameters:
 * - `env`: Environment name (auto-selected if not present or invalid)
 * - `timeRange`: Time range value (defaults to '10m')
 * - `logLevel`: Comma-separated log levels (empty value means none selected)
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
    const envName = searchParams.get('env');
    const timeRange = searchParams.get('timeRange') || DEFAULT_TIME_RANGE;
    const logLevelParam = searchParams.get('logLevel');
    const logLevel =
      logLevelParam === null
        ? [...LOG_LEVELS]
        : LOG_LEVELS.filter(level =>
            new Set(
              logLevelParam
                .split(',')
                .map(v => v.trim())
                .filter(Boolean),
            ).has(level),
          );
    const searchQuery = searchParams.get('search') || undefined;
    const rawSortOrder = searchParams.get('sort');
    const sortOrder: 'asc' | 'desc' =
      rawSortOrder === 'asc' || rawSortOrder === 'desc' ? rawSortOrder : 'asc';

    const isLive = searchParams.get('live') === 'true';
    const componentsParam = searchParams.get('components');
    const components = componentsParam
      ? componentsParam
          .split(',')
          .map(v => v.trim())
          .filter(Boolean)
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
      // Default to all fields
      selectedFields = [...SELECTED_FIELDS];
    }

    const environment = envName
      ? environments.find(e => e.name === envName)
      : undefined;

    return {
      environment: environment?.name || '',
      timeRange,
      logLevel,
      selectedFields,
      components,
      searchQuery,
      sortOrder,
      isLive: isLive || false,
    };
  }, [searchParams, environments]);

  // Auto-select first environment if none selected or URL has a stale env id
  useAutoSelectFirstEnvironment(environments, searchParams, setSearchParams);

  // Update URL when filters change
  const updateFilters = useCallback(
    (newFilters: Partial<RuntimeLogsFilters>) => {
      const newParams = new URLSearchParams(searchParams);

      if (newFilters.environment !== undefined) {
        if (newFilters.environment) {
          newParams.set('env', newFilters.environment);
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
        const isAllSelected =
          newFilters.logLevel.length === LOG_LEVELS.length &&
          LOG_LEVELS.every(l => newFilters.logLevel!.includes(l));
        if (isAllSelected) {
          // Default (all) - remove from URL
          newParams.delete('logLevel');
        } else if (newFilters.logLevel.length === 0) {
          // Explicitly represent none selected
          newParams.set('logLevel', '');
        } else {
          newParams.set('logLevel', newFilters.logLevel.join(','));
        }
      }

      if (newFilters.selectedFields !== undefined) {
        // Ensure Log field is always included
        let fields = newFilters.selectedFields;
        if (!fields.includes(LogEntryField.Log)) {
          fields = [...fields, LogEntryField.Log];
        }

        // Normalize order to match SELECTED_FIELDS
        const normalizedFields = SELECTED_FIELDS.filter(field =>
          fields.includes(field),
        );

        // Only store in URL if not the default (all fields selected)
        const isDefaultFields =
          normalizedFields.length === SELECTED_FIELDS.length &&
          normalizedFields.every(
            (field, index) => field === SELECTED_FIELDS[index],
          );

        if (isDefaultFields) {
          newParams.delete('fields');
        } else {
          newParams.set('fields', normalizedFields.join(','));
        }
      }

      if (newFilters.searchQuery !== undefined) {
        if (newFilters.searchQuery) {
          newParams.set('search', newFilters.searchQuery);
        } else {
          newParams.delete('search');
        }
      }

      if (newFilters.sortOrder !== undefined) {
        if (newFilters.sortOrder === 'asc') {
          // Default value - remove from URL
          newParams.delete('sort');
        } else {
          newParams.set('sort', newFilters.sortOrder);
        }
      }

      if (newFilters.isLive !== undefined) {
        if (newFilters.isLive) {
          newParams.set('live', 'true');
        } else {
          newParams.delete('live');
        }
      }

      if (newFilters.components !== undefined) {
        if (newFilters.components.length > 0) {
          newParams.set('components', newFilters.components.join(','));
        } else {
          newParams.delete('components');
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
      newParams.set('env', environments[0].name);
    }
    setSearchParams(newParams, { replace: true });
  }, [environments, setSearchParams]);

  return { filters, updateFilters, resetFilters };
}
