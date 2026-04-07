import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Environment } from '../types';
import type { IncidentsFilters } from '../components/Incidents/types';
import { useAutoSelectFirstEnvironment } from './useAutoSelectFirstEnvironment';

const DEFAULT_TIME_RANGE = '10m';

interface UseUrlFiltersForIncidentsOptions {
  environments: Environment[];
}

export function useUrlFiltersForIncidents({
  environments,
}: UseUrlFiltersForIncidentsOptions): {
  filters: IncidentsFilters;
  updateFilters: (newFilters: Partial<IncidentsFilters>) => void;
  resetFilters: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<IncidentsFilters>(() => {
    const envName = searchParams.get('env');
    const timeRange = searchParams.get('timeRange') || DEFAULT_TIME_RANGE;
    const rawSortOrder = searchParams.get('sort');
    const sortOrder: 'asc' | 'desc' =
      rawSortOrder === 'asc' || rawSortOrder === 'desc' ? rawSortOrder : 'desc';
    const componentsParam = searchParams.get('components');
    const components = componentsParam
      ? componentsParam.split(',').filter(Boolean)
      : [];
    const statusParam = searchParams.get('status');
    const status = statusParam ? statusParam.split(',').filter(Boolean) : [];
    const searchQuery = searchParams.get('search') || undefined;

    const environment = envName
      ? environments.find(e => e.name === envName)
      : undefined;

    return {
      environment: environment?.name || '',
      timeRange,
      sortOrder,
      components: components.length > 0 ? components : undefined,
      status: status.length > 0 ? status : undefined,
      searchQuery,
    };
  }, [searchParams, environments]);

  useAutoSelectFirstEnvironment(environments, searchParams, setSearchParams);

  const updateFilters = useCallback(
    (newFilters: Partial<IncidentsFilters>) => {
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
          newParams.delete('timeRange');
        } else {
          newParams.set('timeRange', newFilters.timeRange);
        }
      }

      if (newFilters.sortOrder !== undefined) {
        if (newFilters.sortOrder === 'desc') {
          newParams.delete('sort');
        } else {
          newParams.set('sort', newFilters.sortOrder);
        }
      }

      if (newFilters.components !== undefined) {
        if (newFilters.components && newFilters.components.length > 0) {
          newParams.set('components', newFilters.components.join(','));
        } else {
          newParams.delete('components');
        }
      }

      if (newFilters.status !== undefined) {
        if (newFilters.status && newFilters.status.length > 0) {
          newParams.set('status', newFilters.status.join(','));
        } else {
          newParams.delete('status');
        }
      }

      if (newFilters.searchQuery !== undefined) {
        if (newFilters.searchQuery) {
          newParams.set('search', newFilters.searchQuery);
        } else {
          newParams.delete('search');
        }
      }

      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const resetFilters = useCallback(() => {
    const newParams = new URLSearchParams();
    if (environments.length > 0) {
      newParams.set('env', environments[0].name);
    }
    setSearchParams(newParams, { replace: true });
  }, [environments, setSearchParams]);

  return { filters, updateFilters, resetFilters };
}
