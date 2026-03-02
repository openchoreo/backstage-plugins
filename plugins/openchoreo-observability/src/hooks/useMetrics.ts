import { useCallback, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Filters } from '../types';
import { Entity } from '@backstage/catalog-model';
import { Metrics } from '../types';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export function useMetrics(
  filters: Filters,
  entity: Entity,
  namespaceName: string,
  project: string,
) {
  const observabilityApi = useApi(observabilityApiRef);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
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

        const { startTime, endTime } = calculateTimeRange(filters.timeRange);
        const step = calculateStep(filters.timeRange);

        const response = await observabilityApi.getMetrics(
          filters.environment.name,
          componentName,
          namespaceName,
          project,
          { startTime, endTime, step },
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
      namespaceName,
      project,
      entity,
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

function calculateTimeRange(timeRange: string): {
  startTime: string;
  endTime: string;
} {
  const now = new Date();
  const endTime = now.toISOString();

  let startTime: Date;

  switch (timeRange) {
    case '10m':
      startTime = new Date(now.getTime() - 10 * 60 * 1000);
      break;
    case '30m':
      startTime = new Date(now.getTime() - 30 * 60 * 1000);
      break;
    case '1h':
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '14d':
      startTime = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
  }

  return {
    startTime: startTime.toISOString(),
    endTime,
  };
}

function calculateStep(timeRange: string): string {
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
    default:
      return '1m';
  }
}
