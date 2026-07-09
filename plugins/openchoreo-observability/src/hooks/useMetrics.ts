import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Filters, HttpMetrics, MetricType, ResourceMetrics } from '../types';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  calculateTimeRange,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';

export function useMetrics(
  filters: Filters,
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
      componentName ?? null,
      filters.timeRange,
      filters.customStartTime,
      filters.customEndTime,
      metricType,
    ],
    () => {
      if (!componentName) {
        throw new Error('Component name not found in entity annotations');
      }

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
      enabled:
        enabled &&
        !!filters.environment &&
        !!filters.timeRange &&
        !!componentName,
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

function calculateStep(
  timeRange: string,
  startTime?: string,
  endTime?: string,
): string {
  switch (timeRange) {
    case '10m':
      return '15s';
    case '30m':
      return '30s';
    case '1h':
      return '1m';
    case '24h':
      return '5m';
    case '7d':
      return '30m';
    case '14d':
      return '1h';
    case '30d':
      return '2h';
    case 'custom':
      return stepForCustomRange(startTime, endTime);
    default:
      return '1m';
  }
}

/** Pick a step that yields ~120-720 data points for the chosen window. */
function stepForCustomRange(startTime?: string, endTime?: string): string {
  if (!startTime || !endTime) return '1m';
  const durationMs =
    new Date(endTime).getTime() - new Date(startTime).getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) return '1m';
  const minutes = durationMs / (60 * 1000);
  if (minutes <= 30) return '15s';
  if (minutes <= 120) return '30s';
  if (minutes <= 24 * 60) return '5m';
  if (minutes <= 7 * 24 * 60) return '30m';
  if (minutes <= 14 * 24 * 60) return '1h';
  return '2h';
}
