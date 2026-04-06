import { useCallback, useEffect, useState, useMemo } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Filters, Trace } from '../types';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

const sortByStartTime = (traceList: Trace[]): Trace[] =>
  [...traceList].sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
    return bTime - aTime;
  });

export function useTraces(filters: Filters, entity: Entity) {
  const observabilityApi = useApi(observabilityApiRef);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '';
  const projectName = entity.metadata.name as string;

  // Memoize componentIds string for dependency array
  const componentIdsKey = useMemo(
    () => filters.componentIds?.join(',') || '',
    [filters.componentIds],
  );

  // Memoize filtered traces based on searchQuery
  const filteredTraces = useMemo(() => {
    if (!filters.searchQuery || filters.searchQuery.trim() === '') {
      return traces;
    }
    const searchLower = filters.searchQuery.toLowerCase().trim();
    return traces.filter(trace =>
      trace.traceId.toLowerCase().includes(searchLower),
    );
  }, [traces, filters.searchQuery]);

  const fetchTraces = useCallback(async () => {
    if (!filters.environment || !filters.timeRange) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { startTime, endTime } = calculateTimeRange(filters.timeRange);

      const selectedComponents = filters.componentIds ?? [];

      const responses =
        selectedComponents.length > 0
          ? await Promise.all(
              selectedComponents.map(name =>
                observabilityApi.getTraces(
                  namespace,
                  projectName,
                  filters.environment.name,
                  name,
                  { limit: 100, startTime, endTime, sortOrder: 'desc' },
                ),
              ),
            )
          : [
              await observabilityApi.getTraces(
                namespace,
                projectName,
                filters.environment.name,
                undefined,
                { limit: 100, startTime, endTime, sortOrder: 'desc' },
              ),
            ];

      // Merge and deduplicate by traceId (same trace can appear from multiple components)
      const seenIds = new Map<string, Trace>();
      responses
        .flatMap(r => r.traces)
        .forEach(trace => {
          if (!seenIds.has(trace.traceId)) seenIds.set(trace.traceId, trace);
        });
      const merged = sortByStartTime(Array.from(seenIds.values()));

      setTraces(merged);
      setTotal(merged.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch traces');
    } finally {
      setLoading(false);
    }
  }, [
    observabilityApi,
    filters.environment,
    filters.timeRange,
    filters.componentIds,
    namespace,
    projectName,
  ]);

  // Auto-fetch traces when filters change
  useEffect(() => {
    if (filters.environment && filters.timeRange) {
      fetchTraces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.environment, filters.timeRange, componentIdsKey]);

  const refresh = useCallback(() => {
    setTraces([]);
    setTotal(0);
    fetchTraces();
  }, [fetchTraces]);

  return {
    traces: filteredTraces,
    total,
    loading,
    error,
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
