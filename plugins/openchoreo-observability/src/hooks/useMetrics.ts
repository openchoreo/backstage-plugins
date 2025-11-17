import { useCallback, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Filters } from '../types';
import { Entity } from '@backstage/catalog-model';
import { UsageMetrics } from '../types';

export function useMetrics(
  filters: Filters,
  entity: Entity,
  organization: string,
  project: string,
) {
  const observabilityApi = useApi(observabilityApiRef);
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(
    async (reset: boolean = false) => {
      if (!filters.environmentId || !filters.timeRange) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Calculate the start and end times based on the time range
        const { startTime, endTime } = calculateTimeRange(filters.timeRange);

        const response = await observabilityApi.getMetrics(
          entity.metadata.name,
          filters.environmentId,
          organization,
          project,
          {
            limit: 100,
            offset: 0,
            startTime,
            endTime,
          },
        );

        if (reset || !metrics) {
          setMetrics(response);
        }
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
      filters.environmentId,
      filters.timeRange,
      metrics,
      organization,
      project,
      entity.metadata.name,
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
      startTime = new Date(now.getTime() - 60 * 60 * 1000); // Default to 1 hour
  }

  return {
    startTime: startTime.toISOString(),
    endTime,
  };
}
