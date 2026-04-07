import { useCallback, useMemo, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { calculateTimeRange } from '../components/RuntimeLogs/utils';
import { IncidentSummary } from '../types';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface UseProjectIncidentsFilters {
  environment: string;
  timeRange: string;
  components?: string[];
  sortOrder?: 'asc' | 'desc';
}

export interface UseProjectIncidentsResult {
  incidents: IncidentSummary[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  fetchIncidents: (reset?: boolean) => Promise<void>;
  refresh: () => void;
}

export function useProjectIncidents(
  entity: Entity,
  filters: UseProjectIncidentsFilters,
): UseProjectIncidentsResult {
  const observabilityApi = useApi(observabilityApiRef);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const requestVersionRef = useRef(0);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';
  const projectName = entity.metadata.name || '';

  const selectedComponents = useMemo(
    () => Array.from(new Set(filters.components || [])),
    [filters.components],
  );

  const fetchIncidents = useCallback(
    async (_reset = true) => {
      if (!filters.environment || !namespace || !projectName) {
        return;
      }

      const version = ++requestVersionRef.current;

      try {
        setLoading(true);
        setError(null);

        const { startTime, endTime } = calculateTimeRange(filters.timeRange);
        const sortOrder = filters.sortOrder ?? 'desc';

        const queryOptions = {
          limit: 100,
          startTime,
          endTime,
          sortOrder,
        };

        if (selectedComponents.length > 0) {
          const responses = await Promise.all(
            selectedComponents.map(componentName =>
              observabilityApi.getIncidents(
                namespace,
                projectName,
                filters.environment,
                componentName,
                queryOptions,
              ),
            ),
          );

          if (version !== requestVersionRef.current) return;

          const merged = responses.flatMap(r => r.incidents);
          merged.sort((a, b) => {
            const at = (a.triggeredAt || a.timestamp || '').toString();
            const bt = (b.triggeredAt || b.timestamp || '').toString();
            return sortOrder === 'desc'
              ? bt.localeCompare(at)
              : at.localeCompare(bt);
          });
          setIncidents(merged);
          setTotalCount(responses.reduce((acc, r) => acc + (r.total || 0), 0));
        } else {
          const response = await observabilityApi.getIncidents(
            namespace,
            projectName,
            filters.environment,
            undefined,
            queryOptions,
          );

          if (version !== requestVersionRef.current) return;

          setIncidents(response.incidents);
          setTotalCount(response.total);
        }
      } catch (err) {
        if (version !== requestVersionRef.current) return;
        setError(
          err instanceof Error ? err.message : 'Failed to fetch incidents',
        );
      } finally {
        if (version === requestVersionRef.current) {
          setLoading(false);
        }
      }
    },
    [
      observabilityApi,
      filters.environment,
      filters.timeRange,
      filters.sortOrder,
      namespace,
      projectName,
      selectedComponents,
    ],
  );

  const refresh = useCallback(() => {
    setIncidents([]);
    fetchIncidents(true);
  }, [fetchIncidents]);

  return {
    incidents,
    loading,
    error,
    totalCount,
    fetchIncidents,
    refresh,
  };
}
