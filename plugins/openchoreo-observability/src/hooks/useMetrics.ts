import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Filters, HttpMetrics, MetricType, ResourceMetrics } from '../types';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  calculateTimeRange,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';
import { calculateStep } from '../components/Metrics/utils';

export function useMetrics(
  filters: Filters,
  /**
   * A Component entity scopes the query to that component. A Project (System)
   * entity carries no component annotation, so the component is omitted from
   * `searchScope` and the observer returns the project-wide aggregate in the
   * same schema — which is what the project Metrics tab renders.
   */
  entity: Entity,
  namespaceName: string,
  project: string,
  metricType: MetricType = 'resource',
  /**
   * Consumer-supplied gate — the page only wants metrics fetched once its own
   * preconditions hold (metrics-view permission, HTTP-metrics enabled). Folded
   * into the query's `enabled` so no request fires while the gate is false,
   * preserving the old imperative "call fetchMetrics() only when allowed" flow.
   * @default true
   */
  enabled: boolean = true,
) {
  const observabilityApi = useApi(observabilityApiRef);

  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery<
    ResourceMetrics | HttpMetrics
  >(
    [
      'metrics',
      namespaceName,
      project,
      filters.environment?.name ?? null,
      // `null` for the project-wide query keeps it in its own cache slot rather
      // than colliding with a component-scoped one.
      componentName ?? null,
      filters.timeRange,
      filters.customStartTime,
      filters.customEndTime,
      metricType,
    ],
    () => {
      const { startTime, endTime } = calculateTimeRange(filters.timeRange, {
        startTime: filters.customStartTime,
        endTime: filters.customEndTime,
      });
      const step = calculateStep(filters.timeRange, startTime, endTime);

      return observabilityApi.getMetrics(
        filters.environment.name,
        componentName,
        namespaceName,
        project,
        { startTime, endTime, step, type: metricType },
      );
    },
    {
      enabled: enabled && !!filters.environment && !!filters.timeRange,
    },
  );

  return {
    metrics: data ?? null,
    loading,
    isRefetching,
    error: error ? error.message || 'Failed to fetch metrics' : null,
    fetchMetrics: (_reset: boolean = false) => refetch(),
    refresh: refetch,
  };
}
