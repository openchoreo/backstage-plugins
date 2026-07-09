import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Entity } from '@backstage/catalog-model';
import { EventEntry } from '../components/RuntimeEvents/types';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  calculateTimeRange,
  useOpenChoreoInfiniteQuery,
} from '@openchoreo/backstage-plugin-react';

export interface UseRuntimeEventsOptions {
  environment: string;
  timeRange: string;
  /** ISO start time, used when `timeRange === 'custom'` */
  customStartTime?: string;
  /** ISO end time, used when `timeRange === 'custom'` */
  customEndTime?: string;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
  isLive?: boolean;
}

export interface UseRuntimeEventsResult {
  events: EventEntry[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  fetchEvents: (reset?: boolean) => Promise<void>;
  loadMore: () => void;
  refresh: () => void;
  clearEvents: () => void;
}

/**
 * Hook for fetching runtime Kubernetes events for a component.
 *
 * Cursor-paginated over timestamps (see {@link useRuntimeLogs}); live mode
 * re-fetches from the first page every 5s.
 *
 * @param entity - The Backstage entity
 * @param namespaceName - Namespace name
 * @param project - Project name
 * @param options - Runtime events options (environment, time range, etc.)
 * @returns Runtime events data and control functions
 */
export function useRuntimeEvents(
  entity: Entity,
  namespaceName: string,
  project: string,
  options: UseRuntimeEventsOptions,
  /** Consumer gate (e.g. events-view permission). Folded into `enabled`. @default true */
  enabled: boolean = true,
): UseRuntimeEventsResult {
  const observabilityApi = useApi(observabilityApiRef);

  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const pageSize = options.limit || 50;
  const sortOrder = options.sortOrder || 'asc';

  const {
    items,
    loading,
    isRefetching,
    loadingMore,
    error,
    totalCount,
    hasMore,
    loadMore,
    refresh,
  } = useOpenChoreoInfiniteQuery<EventEntry>(
    [
      'runtime-events',
      namespaceName,
      project,
      options.environment,
      componentName ?? null,
      options.timeRange,
      options.customStartTime,
      options.customEndTime,
      sortOrder,
      pageSize,
    ],
    async cursor => {
      const { startTime: initialStartTime, endTime: initialEndTime } =
        calculateTimeRange(options.timeRange, {
          startTime: options.customStartTime,
          endTime: options.customEndTime,
        });

      let startTime = initialStartTime;
      let endTime = initialEndTime;
      if (cursor) {
        if (sortOrder === 'desc') endTime = cursor;
        else startTime = cursor;
      }

      const response = await observabilityApi.getRuntimeEvents(
        namespaceName,
        project,
        options.environment,
        componentName!,
        { limit: pageSize, startTime, endTime, sortOrder },
      );
      return { items: response.events, total: response.total ?? 0 };
    },
    {
      pageSize,
      getCursor: last => last.timestamp,
      enabled: enabled && !!options.environment && !!componentName,
      refetchInterval: options.isLive ? 5000 : false,
    },
  );

  return {
    events: items,
    loading: loading || loadingMore,
    isRefetching,
    error: error ? error.message || 'Failed to fetch events' : null,
    totalCount,
    hasMore,
    fetchEvents: async () => {
      refresh();
    },
    loadMore,
    refresh,
    clearEvents: refresh,
  };
}
