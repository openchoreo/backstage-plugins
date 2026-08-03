import { useMemo } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { observabilityApiRef } from '../api/ObservabilityApi';
import {
  calculateTimeRange,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';
import { IncidentSummary } from '../types';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface UseProjectIncidentsFilters {
  environment: string;
  timeRange: string;
  /** ISO start time, used when `timeRange === 'custom'` */
  customStartTime?: string;
  /** ISO end time, used when `timeRange === 'custom'` */
  customEndTime?: string;
  components?: string[];
  sortOrder?: 'asc' | 'desc';
}

export interface UseProjectIncidentsResult {
  incidents: IncidentSummary[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
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

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';
  const projectName = entity.metadata.name || '';

  const selectedComponents = useMemo(
    () => Array.from(new Set(filters.components || [])),
    [filters.components],
  );

  // Filters (including the component set) are folded into the key, so a change
  // starts a fresh query and superseded responses are dropped — replacing the
  // manual `requestVersionRef` race-guard.
  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery<{
    incidents: IncidentSummary[];
    totalCount: number;
  }>(
    [
      'project-incidents',
      namespace,
      projectName,
      filters.environment,
      filters.timeRange,
      filters.customStartTime,
      filters.customEndTime,
      filters.sortOrder ?? 'desc',
      selectedComponents.join(','),
    ],
    async () => {
      const { startTime, endTime } = calculateTimeRange(filters.timeRange, {
        startTime: filters.customStartTime,
        endTime: filters.customEndTime,
      });
      const sortOrder = filters.sortOrder ?? 'desc';
      const queryOptions = { limit: 100, startTime, endTime, sortOrder };

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
        const merged = responses.flatMap(r => r.incidents);
        merged.sort((a, b) => {
          const at = (a.triggeredAt || a.timestamp || '').toString();
          const bt = (b.triggeredAt || b.timestamp || '').toString();
          return sortOrder === 'desc'
            ? bt.localeCompare(at)
            : at.localeCompare(bt);
        });
        return {
          incidents: merged,
          totalCount: responses.reduce((acc, r) => acc + (r.total || 0), 0),
        };
      }

      const response = await observabilityApi.getIncidents(
        namespace,
        projectName,
        filters.environment,
        undefined,
        queryOptions,
      );
      return { incidents: response.incidents, totalCount: response.total };
    },
    { enabled: !!filters.environment && !!namespace && !!projectName },
  );

  return {
    incidents: data?.incidents ?? [],
    loading,
    isRefetching,
    error: error ? error.message || 'Failed to fetch incidents' : null,
    totalCount: data?.totalCount ?? 0,
    // Kept for API compatibility; filter changes refetch on their own via the key.
    fetchIncidents: async () => {
      await refetch();
    },
    refresh: refetch,
  };
}
