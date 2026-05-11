import { useCallback, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Filters, HttpMetrics, MetricType, ResourceMetrics } from '../types';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { calculateTimeRange } from '@openchoreo/backstage-plugin-react';

export function useMetrics(
  filters: Filters,
  entity: Entity,
  namespaceName: string,
  project: string,
  metricType: MetricType = 'resource',
) {
  const observabilityApi = useApi(observabilityApiRef);
  const [metrics, setMetrics] = useState<ResourceMetrics | HttpMetrics | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(
    async (_reset: boolean = false) => {
      if (!filters.environment || !filters.timeRange) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const componentName =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
        if (!componentName) {
          throw new Error('Component name not found in entity annotations');
        }

        const { startTime, endTime } = calculateTimeRange(filters.timeRange, {
          startTime: filters.customStartTime,
          endTime: filters.customEndTime,
        });
        const step = calculateStep(filters.timeRange, startTime, endTime);

        const response = await observabilityApi.getMetrics(
          filters.environment.name,
          componentName,
          namespaceName,
          project,
          { startTime, endTime, step, type: metricType },
        );

        setMetrics(response);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch metrics',
        );
      } finally {
        setLoading(false);
      }
    },
    [
      observabilityApi,
      filters.environment,
      filters.timeRange,
      filters.customStartTime,
      filters.customEndTime,
      namespaceName,
      project,
      entity,
      metricType,
    ],
  );

  const refresh = useCallback(() => {
    setMetrics(null);
    fetchMetrics(true);
  }, [fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    fetchMetrics,
    refresh,
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
