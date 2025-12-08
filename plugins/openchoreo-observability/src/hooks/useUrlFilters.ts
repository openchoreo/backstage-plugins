import { useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Filters, Environment } from '../types';

const DEFAULT_TIME_RANGE = '1h';

interface UseUrlFiltersOptions {
  /** Available environments to map names to objects */
  environments: Environment[];
}

/**
 * Hook for managing observability filters synced to URL query parameters.
 *
 * Query parameters:
 * - `env`: Environment name
 * - `timeRange`: Time range value (defaults to '1h')
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
    const componentIds =
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
      componentIds,
      searchQuery,
    };
  }, [searchParams, environments]);

  // Auto-select first environment if none in URL and environments are loaded
  useEffect(() => {
    if (environments.length > 0 && !searchParams.get('env')) {
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

      if (newFilters.componentIds !== undefined) {
        if (newFilters.componentIds.length > 0) {
          newParams.set('components', newFilters.componentIds.join(','));
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
