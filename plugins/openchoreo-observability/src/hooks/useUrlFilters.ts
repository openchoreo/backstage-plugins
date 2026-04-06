import { useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Filters, Environment } from '../types';

const DEFAULT_TIME_RANGE = '10m';

interface UseUrlFiltersOptions {
  /** Available environments to map names to objects */
  environments: Environment[];
}

/**
 * Hook for managing observability filters synced to URL query parameters.
 *
 * Query parameters:
 * - `env`: Environment name
 * - `timeRange`: Time range value (defaults to '10m')
 * - `components`: Comma-separated component IDs
 * - `q`: Search query string
 *
 * @example
 * ```tsx
 * const { filters, updateFilters, resetFilters } = useUrlFilters({
 *   environments,
 * });
 *
 * // Read filter values
 * console.log(filters.environment, filters.timeRange);
 *
 * // Update filters (writes to URL)
 * updateFilters({ timeRange: '24h' });
 * ```
 */
export function useUrlFilters({ environments }: UseUrlFiltersOptions) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL
  const filters = useMemo<Filters>(() => {
    const envName = searchParams.get('env');
    const timeRange = searchParams.get('timeRange') || DEFAULT_TIME_RANGE;
    const components =
      searchParams.get('components')?.split(',').filter(Boolean) || [];
    const searchQuery = searchParams.get('q') || '';

    // Find environment by name
    const environment = envName
      ? environments.find(
          e =>
            e.name === envName ||
            e.displayName === envName ||
            e.name.toLowerCase() === envName.toLowerCase(),
        ) || (null as unknown as Environment)
      : (null as unknown as Environment);

    return {
      environment,
      timeRange,
      components,
      searchQuery,
    };
  }, [searchParams, environments]);

  // Auto-select first environment if none selected or URL has a stale env name
  useEffect(() => {
    if (environments.length === 0) return;
    const envParam = searchParams.get('env');
    const isValid =
      envParam &&
      environments.some(
        e =>
          e.name === envParam ||
          e.displayName === envParam ||
          e.name.toLowerCase() === envParam.toLowerCase(),
      );
    if (!isValid) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('env', environments[0].name);
      setSearchParams(newParams, { replace: true });
    }
  }, [environments, searchParams, setSearchParams]);

  // Update URL when filters change
  const updateFilters = useCallback(
    (newFilters: Partial<Filters>) => {
      const newParams = new URLSearchParams(searchParams);

      if (newFilters.environment !== undefined) {
        if (newFilters.environment) {
          newParams.set('env', newFilters.environment.name);
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

      if (newFilters.components !== undefined) {
        if (newFilters.components.length > 0) {
          newParams.set('components', newFilters.components.join(','));
        } else {
          newParams.delete('components');
        }
      }

      if (newFilters.searchQuery !== undefined) {
        if (newFilters.searchQuery) {
          newParams.set('q', newFilters.searchQuery);
        } else {
          newParams.delete('q');
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
