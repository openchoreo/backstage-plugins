import { useMemo } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Filters, Trace } from '../types';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  calculateTimeRange,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';

const sortByStartTime = (traceList: Trace[]): Trace[] =>
  [...traceList].sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
    return bTime - aTime;
  });

export function useTraces(filters: Filters, entity: Entity) {
  const observabilityApi = useApi(observabilityApiRef);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '';
  const projectName = entity.metadata.name as string;

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery<
    Trace[]
  >(
    [
      'traces',
      namespace,
      projectName,
      filters.environment?.name,
      filters.timeRange,
      filters.customStartTime,
      filters.customEndTime,
      filters.components?.join(',') ?? '',
    ],
    async () => {
      const { startTime, endTime } = calculateTimeRange(filters.timeRange, {
        startTime: filters.customStartTime,
        endTime: filters.customEndTime,
      });

      const selectedComponents = filters.components ?? [];

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
      return sortByStartTime(Array.from(seenIds.values()));
    },
    { enabled: !!filters.environment && !!filters.timeRange },
  );

  // Memoize filtered traces based on searchQuery (client-side, not part of the
  // query key so it never triggers a refetch on keystroke).
  const filteredTraces = useMemo(() => {
    const traces = data ?? [];
    if (!filters.searchQuery || filters.searchQuery.trim() === '') {
      return traces;
    }
    const searchLower = filters.searchQuery.toLowerCase().trim();
    return traces.filter(trace =>
      trace.traceId.toLowerCase().includes(searchLower),
    );
  }, [data, filters.searchQuery]);

  return {
    traces: filteredTraces,
    total: data?.length ?? 0,
    loading,
    isRefetching,
    error: error ? error.message || 'Failed to fetch traces' : null,
    refresh: refetch,
  };
}
