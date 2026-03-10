import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Environment } from '../components/RuntimeLogs/types';
import type { AlertsFilters } from '../components/Alerts/types';
import {
  ALERTS_TIME_RANGE_OPTIONS,
  ALERT_SEVERITIES,
} from '../components/Alerts/types';

const DEFAULT_TIME_RANGE = '1h';
const VALID_TIME_RANGES: readonly string[] = ALERTS_TIME_RANGE_OPTIONS.map(
  o => o.value,
);
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
    const envId = searchParams.get('env');
    const rawTimeRange = searchParams.get('timeRange') || DEFAULT_TIME_RANGE;
    const timeRange = VALID_TIME_RANGES.includes(rawTimeRange)
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

    const environment = envId
      ? environments.find(e => e.id === envId)
      : undefined;

    return {
      environmentId: environment?.id || '',
      timeRange,
      sortOrder,
      severity: severity.length > 0 ? severity : undefined,
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
    (newFilters: Partial<AlertsFilters>) => {
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
      newParams.set('env', environments[0].id);
    }
    setSearchParams(newParams, { replace: true });
  }, [environments, setSearchParams]);

  return { filters, updateFilters, resetFilters };
}
