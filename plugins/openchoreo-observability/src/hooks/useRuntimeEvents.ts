import { useCallback, useEffect, useState, useRef } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Entity } from '@backstage/catalog-model';
import { EventEntry } from '../components/RuntimeEvents/types';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { calculateTimeRange } from '@openchoreo/backstage-plugin-react';

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
): UseRuntimeEventsResult {
  const observabilityApi = useApi(observabilityApiRef);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const fetchGenerationRef = useRef<number>(0);
  const eventsRef = useRef<EventEntry[]>([]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const fetchEvents = useCallback(
    async (reset: boolean = false) => {
      if (!options.environment) {
        return;
      }

      // Check if a fetch is already in progress
      if (inFlightRef.current) {
        return;
      }

      const generation = fetchGenerationRef.current;

      try {
        inFlightRef.current = true;
        setLoading(true);
        setError(null);

        const componentName =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
        if (!componentName) {
          throw new Error('Component name not found in entity annotations');
        }

        // Calculate the start and end times based on the time range
        const { startTime: initialStartTime, endTime: initialEndTime } =
          calculateTimeRange(options.timeRange, {
            startTime: options.customStartTime,
            endTime: options.customEndTime,
          });

        // Use timestamp-based pagination instead of offset
        let endTime = initialEndTime;
        let startTime = initialStartTime;
        if (!reset && eventsRef.current.length > 0) {
          // For load more, use the timestamp of the last event as the new
          // endTime or startTime based on the sort order
          const lastEvent = eventsRef.current[eventsRef.current.length - 1];
          const sortOrder = options.sortOrder || 'asc';
          if (sortOrder === 'desc') {
            endTime = lastEvent.timestamp ?? endTime;
          } else {
            startTime = lastEvent.timestamp ?? startTime;
          }
        }

        const response = await observabilityApi.getRuntimeEvents(
          namespaceName,
          project,
          options.environment,
          componentName,
          {
            limit: options.limit || 50,
            startTime,
            endTime,
            sortOrder: options.sortOrder || 'asc',
          },
        );

        if (fetchGenerationRef.current !== generation) return;

        if (reset) {
          setEvents(response.events);
          setTotalCount(response.total ?? 0);
        } else {
          setEvents(prev => [...prev, ...response.events]);
        }

        setHasMore(response.events.length === (options.limit || 50));
      } catch (err) {
        if (fetchGenerationRef.current === generation) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch events',
          );
        }
      } finally {
        setLoading(false);
        inFlightRef.current = false;
      }
    },
    [
      observabilityApi,
      options.environment,
      options.timeRange,
      options.customStartTime,
      options.customEndTime,
      options.limit,
      options.sortOrder,
      namespaceName,
      project,
      entity,
    ],
  );

  // Live polling effect
  useEffect(() => {
    // Always clear any existing interval first
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (!options.isLive) {
      return undefined;
    }

    // Set up polling interval (5 seconds)
    pollingIntervalRef.current = setInterval(() => {
      fetchEvents(true);
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      inFlightRef.current = false;
    };
  }, [options.isLive, fetchEvents]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore && !error && events.length > 0) {
      fetchEvents(false);
    }
  }, [fetchEvents, hasMore, loading, error, events.length]);

  const refresh = useCallback(() => {
    setEvents([]);
    fetchEvents(true);
  }, [fetchEvents]);

  const clearEvents = useCallback(() => {
    fetchGenerationRef.current += 1;
    setEvents([]);
    setTotalCount(0);
    setHasMore(true);
  }, []);

  return {
    events,
    loading,
    error,
    totalCount,
    hasMore,
    fetchEvents,
    loadMore,
    refresh,
    clearEvents,
  };
}
