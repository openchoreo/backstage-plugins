import { useCallback, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { calculateTimeRange } from '../components/RuntimeLogs/utils';
import { AlertSummary } from '../types';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface UseComponentAlertsOptions {
  environment: string;
  timeRange: string;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

export interface UseComponentAlertsResult {
  alerts: AlertSummary[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  fetchAlerts: (reset?: boolean) => Promise<void>;
  refresh: () => void;
}

export function useComponentAlerts(
  entity: Entity,
  namespace: string,
  project: string,
  options: UseComponentAlertsOptions,
): UseComponentAlertsResult {
  const observabilityApi = useApi(observabilityApiRef);
  const [alerts, setAlerts] = useState<AlertSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const requestVersionRef = useRef(0);

  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

  const fetchAlerts = useCallback(
    async (_reset = true) => {
      if (!options.environment || !namespace || !project || !componentName) {
        return;
      }

      const version = ++requestVersionRef.current;

      try {
        setLoading(true);
        setError(null);

        const { startTime, endTime } = calculateTimeRange(options.timeRange);

        const response = await observabilityApi.getAlerts(
          namespace,
          project,
          options.environment,
          componentName,
          {
            limit: options.limit ?? 100,
            startTime,
            endTime,
            sortOrder: options.sortOrder ?? 'desc',
          },
        );

        // Discard result if a newer request has been started
        if (version !== requestVersionRef.current) return;

        setAlerts(response.alerts ?? []);
        setTotalCount(response.total ?? 0);
      } catch (err) {
        if (version !== requestVersionRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
      } finally {
        if (version === requestVersionRef.current) {
          setLoading(false);
        }
      }
    },
    [
      observabilityApi,
      options.environment,
      options.timeRange,
      options.limit,
      options.sortOrder,
      namespace,
      project,
      componentName,
    ],
  );

  const refresh = useCallback(() => {
    setAlerts([]);
    fetchAlerts(true);
  }, [fetchAlerts]);

  return {
    alerts,
    loading,
    error,
    totalCount,
    fetchAlerts,
    refresh,
  };
}
