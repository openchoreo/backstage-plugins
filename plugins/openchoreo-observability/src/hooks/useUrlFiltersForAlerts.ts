import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TIME_RANGE_OPTIONS } from '../types';
import type { Environment } from '../types';
import type { AlertsFilters } from '../components/Alerts/types';
import { ALERT_SEVERITIES } from '../components/Alerts/types';
import { useAutoSelectFirstEnvironment } from './useAutoSelectFirstEnvironment';

const DEFAULT_TIME_RANGE = '10m';
const VALID_SEVERITIES: readonly string[] = ALERT_SEVERITIES;

interface UseUrlFiltersForAlertsOptions {
  environments: Environment[];
}

export function useUrlFiltersForAlerts({
  environments,
}: UseUrlFiltersForAlertsOptions): {
  filters: AlertsFilters;
  updateFilters: (newFilters: Partial<AlertsFilters>) => void;
  resetFilters: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<AlertsFilters>(() => {
    const envName = searchParams.get('env');
    const rawTimeRange = searchParams.get('timeRange') || DEFAULT_TIME_RANGE;
    const timeRange = TIME_RANGE_OPTIONS.some(o => o.value === rawTimeRange)
      ? rawTimeRange
      : DEFAULT_TIME_RANGE;
    const rawSortOrder = searchParams.get('sort');
    const sortOrder: 'asc' | 'desc' =
      rawSortOrder === 'asc' || rawSortOrder === 'desc' ? rawSortOrder : 'desc';
    const severityParam = searchParams.get('severity');
    const severity = severityParam
      ? severityParam
          .split(',')
          .filter(s => Boolean(s) && VALID_SEVERITIES.includes(s))
      : [];
    const searchQuery = searchParams.get('search') || undefined;

    const environment = envName
      ? environments.find(e => e.name === envName)
      : undefined;

    return {
      environment: environment?.name || '',
      timeRange,
      sortOrder,
      severity: severity.length > 0 ? severity : undefined,
      searchQuery,
    };
  }, [searchParams, environments]);

  useAutoSelectFirstEnvironment(environments, searchParams, setSearchParams);

  const updateFilters = useCallback(
    (newFilters: Partial<AlertsFilters>) => {
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

      if (newFilters.severity !== undefined) {
        if (newFilters.severity && newFilters.severity.length > 0) {
          newParams.set('severity', newFilters.severity.join(','));
        } else {
          newParams.delete('severity');
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
