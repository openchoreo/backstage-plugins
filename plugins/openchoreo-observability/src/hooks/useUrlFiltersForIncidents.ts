import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Environment } from '../components/RuntimeLogs/types';
import type { IncidentsFilters } from '../components/Incidents/types';

const DEFAULT_TIME_RANGE = '1h';

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
    const envId = searchParams.get('env');
    const timeRange = searchParams.get('timeRange') || DEFAULT_TIME_RANGE;
    const rawSortOrder = searchParams.get('sort');
    const sortOrder: 'asc' | 'desc' =
      rawSortOrder === 'asc' || rawSortOrder === 'desc' ? rawSortOrder : 'desc';
    const componentIdsParam = searchParams.get('components');
    const componentIds = componentIdsParam
      ? componentIdsParam.split(',').filter(Boolean)
      : [];
    const statusParam = searchParams.get('status');
    const status = statusParam ? statusParam.split(',').filter(Boolean) : [];
    const searchQuery = searchParams.get('search') || undefined;

    const environment = envId
      ? environments.find(e => e.id === envId)
      : undefined;

    return {
      environmentId: environment?.id || '',
      timeRange,
      sortOrder,
      componentIds: componentIds.length > 0 ? componentIds : undefined,
      status: status.length > 0 ? status : undefined,
      searchQuery,
    };
  }, [searchParams, environments]);

  useEffect(() => {
    if (environments.length === 0) return;
    const envParam = searchParams.get('env');
    const isValid = envParam && environments.some(e => e.id === envParam);
    if (!isValid) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('env', environments[0].id);
      setSearchParams(newParams, { replace: true });
    }
  }, [environments, searchParams, setSearchParams]);

  const updateFilters = useCallback(
    (newFilters: Partial<IncidentsFilters>) => {
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

      if (newFilters.componentIds !== undefined) {
        if (newFilters.componentIds && newFilters.componentIds.length > 0) {
          newParams.set('components', newFilters.componentIds.join(','));
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
      newParams.set('env', environments[0].id);
    }
    setSearchParams(newParams, { replace: true });
  }, [environments, setSearchParams]);

  return { filters, updateFilters, resetFilters };
}
