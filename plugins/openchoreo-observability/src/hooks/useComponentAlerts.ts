import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { observabilityApiRef } from '../api/ObservabilityApi';
import {
  calculateTimeRange,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';
import { AlertSummary } from '../types';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface UseComponentAlertsOptions {
  environment: string;
  timeRange: string;
  /** ISO start time, used when `timeRange === 'custom'` */
  customStartTime?: string;
  /** ISO end time, used when `timeRange === 'custom'` */
  customEndTime?: string;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

export interface UseComponentAlertsResult {
  alerts: AlertSummary[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
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

  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

  // Every param is folded into the query key, so a filter change starts a fresh
  // query and the cache discards superseded responses — replacing the manual
  // `requestVersionRef` race-guard the hand-rolled version carried.
  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    [
      'component-alerts',
      namespace,
      project,
      options.environment,
      componentName ?? null,
      options.timeRange,
      options.customStartTime,
      options.customEndTime,
      options.limit ?? 100,
      options.sortOrder ?? 'desc',
    ],
    () => {
      const { startTime, endTime } = calculateTimeRange(options.timeRange, {
        startTime: options.customStartTime,
        endTime: options.customEndTime,
      });
      return observabilityApi.getAlerts(
        namespace,
        project,
        options.environment,
        componentName!,
        {
          limit: options.limit ?? 100,
          startTime,
          endTime,
          sortOrder: options.sortOrder ?? 'desc',
        },
      );
    },
    {
      enabled:
        !!options.environment && !!namespace && !!project && !!componentName,
    },
  );

  return {
    alerts: data?.alerts ?? [],
    loading,
    isRefetching,
    error: error ? error.message || 'Failed to fetch alerts' : null,
    totalCount: data?.total ?? 0,
    // Kept for API compatibility — a manual (re)fetch now just triggers refetch;
    // filter changes refetch on their own via the key.
    fetchAlerts: async () => {
      await refetch();
    },
    refresh: refetch,
  };
}
