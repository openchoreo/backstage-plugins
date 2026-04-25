import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Environment } from '../components/RuntimeLogs/types';
import type { TriggersFilters } from '../components/Triggers/types';
import { TRIGGERS_TIME_RANGE_OPTIONS } from '../components/Triggers/types';

const DEFAULT_TIME_RANGE = '24h';
const VALID_TIME_RANGES: readonly string[] = TRIGGERS_TIME_RANGE_OPTIONS.map(
  o => o.value,
);

interface UseUrlFiltersForTriggersOptions {
  environments: Environment[];
}

export function useUrlFiltersForTriggers({
  environments,
}: UseUrlFiltersForTriggersOptions): {
  filters: TriggersFilters;
  updateFilters: (newFilters: Partial<TriggersFilters>) => void;
  resetFilters: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<TriggersFilters>(() => {
    const envId = searchParams.get('env');
    const rawTimeRange = searchParams.get('timeRange') || DEFAULT_TIME_RANGE;
    const timeRange = VALID_TIME_RANGES.includes(rawTimeRange)
      ? rawTimeRange
      : DEFAULT_TIME_RANGE;
    const rawSortOrder = searchParams.get('sort');
    const sortOrder: 'asc' | 'desc' =
      rawSortOrder === 'asc' || rawSortOrder === 'desc' ? rawSortOrder : 'desc';
    const rawPage = searchParams.get('page');
    const page = rawPage ? Math.max(0, parseInt(rawPage, 10) || 0) : 0;

    const environment = envId
      ? environments.find(e => e.id === envId)
      : undefined;

    return {
      environmentId: environment?.id || '',
      timeRange,
      sortOrder,
      page,
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
    (newFilters: Partial<TriggersFilters>) => {
      const newParams = new URLSearchParams(searchParams);

      if (newFilters.environmentId !== undefined) {
        if (newFilters.environmentId) {
          newParams.set('env', newFilters.environmentId);
        } else {
          newParams.delete('env');
        }
        // Reset page when environment changes
        newParams.delete('page');
      }

      if (newFilters.timeRange !== undefined) {
        if (newFilters.timeRange === DEFAULT_TIME_RANGE) {
          newParams.delete('timeRange');
        } else {
          newParams.set('timeRange', newFilters.timeRange);
        }
        // Reset page when time range changes
        newParams.delete('page');
      }

      if (newFilters.sortOrder !== undefined) {
        if (newFilters.sortOrder === 'desc') {
          newParams.delete('sort');
        } else {
          newParams.set('sort', newFilters.sortOrder);
        }
        // Reset page when sort changes
        newParams.delete('page');
      }

      if (newFilters.page !== undefined) {
        if (newFilters.page === 0) {
          newParams.delete('page');
        } else {
          newParams.set('page', String(newFilters.page));
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
