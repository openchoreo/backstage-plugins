import { useCallback, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoCache } from '@openchoreo/backstage-plugin-react';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Span } from '../types';

interface UseTraceSpansOptions {
  namespaceName: string;
  projectName: string;
  environmentName: string;
  componentName?: string;
  startTime?: string;
  endTime?: string;
}

/**
 * Lazily loads spans per trace id, on demand (a row expands → `fetchSpans(id)`).
 * The span data is cached in the shared query cache — keyed by trace id + scope
 * — so re-expanding a row (or revisiting the page) serves instantly and dedupes
 * concurrent expands. Per-key loading/error remain local UI state; only the
 * server data lives in the cache.
 */
export function useTraceSpans(options: UseTraceSpansOptions) {
  const observabilityApi = useApi(observabilityApiRef);
  const cache = useOpenChoreoCache();
  const [loadingMap, setLoadingMap] = useState<Map<string, boolean>>(new Map());
  const [errorMap, setErrorMap] = useState<Map<string, string>>(new Map());
  // Bumped whenever a fetch resolves so cache-backed reads re-render.
  const [, setVersion] = useState(0);

  // A trace id is globally unique and a trace is atomic, so its spans are the
  // same regardless of the filter/time scope used to find it in the list. Key
  // by trace id alone (user-scoped by the cache) — the scope/time only belong
  // in the trace-list key, which does depend on the filters.
  const spanKey = useCallback(
    (traceId: string) => ['trace-spans', traceId],
    [],
  );

  const fetchSpans = useCallback(
    async (traceId: string) => {
      // Already loading, or already cached for this scope.
      if (
        loadingMap.get(traceId) ||
        cache.getData<Span[]>(spanKey(traceId)) !== undefined
      ) {
        return;
      }

      setLoadingMap(prev => new Map(prev).set(traceId, true));
      setErrorMap(prev => {
        const next = new Map(prev);
        next.delete(traceId);
        return next;
      });

      try {
        await cache.fetchQuery<Span[]>(spanKey(traceId), async () => {
          const result = await observabilityApi.getTraceSpans(
            traceId,
            options.namespaceName,
            options.projectName,
            options.environmentName,
            options.componentName,
            { startTime: options.startTime, endTime: options.endTime },
          );
          return result.spans;
        });
        setVersion(v => v + 1);
      } catch (err) {
        setErrorMap(prev =>
          new Map(prev).set(
            traceId,
            err instanceof Error ? err.message : 'Failed to fetch spans',
          ),
        );
      } finally {
        setLoadingMap(prev => {
          const next = new Map(prev);
          next.delete(traceId);
          return next;
        });
      }
    },
    [observabilityApi, options, loadingMap, cache, spanKey],
  );

  const getSpans = useCallback(
    (traceId: string): Span[] | undefined =>
      cache.getData<Span[]>(spanKey(traceId)),
    [cache, spanKey],
  );

  const isLoading = useCallback(
    (traceId: string): boolean => loadingMap.get(traceId) ?? false,
    [loadingMap],
  );

  const getError = useCallback(
    (traceId: string): string | undefined => errorMap.get(traceId),
    [errorMap],
  );

  const clearSpans = useCallback(
    (traceId: string) => {
      // `setData(key, () => undefined)` is a no-op in TanStack — removeQueries
      // actually drops the entry so a re-expand refetches instead of serving
      // the stale cached spans.
      cache.remove(spanKey(traceId));
      setVersion(v => v + 1);
    },
    [cache, spanKey],
  );

  return {
    fetchSpans,
    getSpans,
    isLoading,
    getError,
    clearSpans,
  };
}
