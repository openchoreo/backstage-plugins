import { useCallback, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoCache } from '@openchoreo/backstage-plugin-react';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { SpanDetails } from '../types';

interface UseSpanDetailsOptions {
  namespaceName: string;
  projectName: string;
  environmentName: string;
  componentName?: string;
}

/**
 * Lazily loads a single span's details on demand, keyed by trace+span id. The
 * details are cached in the shared query cache (keyed by ids + scope) so
 * reopening the same span serves instantly and dedupes concurrent opens. Per-key
 * loading/error stay local UI state; only the server data lives in the cache.
 */
export function useSpanDetails(options: UseSpanDetailsOptions) {
  const observabilityApi = useApi(observabilityApiRef);
  const cache = useOpenChoreoCache();
  const [loadingMap, setLoadingMap] = useState<Map<string, boolean>>(new Map());
  const [errorMap, setErrorMap] = useState<Map<string, string>>(new Map());
  // Bumped whenever a fetch resolves so cache-backed reads re-render.
  const [, setVersion] = useState(0);

  // Composite key for the local loading/error maps. Scoped to match detailsKey
  // so switching components can't reuse another scope's pending/error state.
  const makeKey = useCallback(
    (traceId: string, spanId: string) =>
      [
        options.namespaceName,
        options.projectName,
        options.environmentName,
        options.componentName ?? '',
        traceId,
        spanId,
      ].join('::'),
    [
      options.namespaceName,
      options.projectName,
      options.environmentName,
      options.componentName,
    ],
  );

  const detailsKey = useCallback(
    (traceId: string, spanId: string) => [
      'span-details',
      options.namespaceName,
      options.projectName,
      options.environmentName,
      options.componentName ?? '',
      traceId,
      spanId,
    ],
    [
      options.namespaceName,
      options.projectName,
      options.environmentName,
      options.componentName,
    ],
  );

  const fetchSpanDetails = useCallback(
    async (traceId: string, spanId: string) => {
      const key = makeKey(traceId, spanId);

      if (
        loadingMap.get(key) ||
        cache.getData<SpanDetails>(detailsKey(traceId, spanId)) !== undefined
      ) {
        return;
      }

      setLoadingMap(prev => new Map(prev).set(key, true));
      setErrorMap(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      try {
        await cache.fetchQuery<SpanDetails>(detailsKey(traceId, spanId), () =>
          observabilityApi.getSpanDetails(
            traceId,
            spanId,
            options.namespaceName,
            options.projectName,
            options.environmentName,
            options.componentName,
          ),
        );
        setVersion(v => v + 1);
      } catch (err) {
        setErrorMap(prev =>
          new Map(prev).set(
            key,
            err instanceof Error ? err.message : 'Failed to fetch span details',
          ),
        );
      } finally {
        setLoadingMap(prev => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [observabilityApi, options, loadingMap, cache, detailsKey, makeKey],
  );

  const getDetails = useCallback(
    (traceId: string, spanId: string): SpanDetails | undefined =>
      cache.getData<SpanDetails>(detailsKey(traceId, spanId)),
    [cache, detailsKey],
  );

  const isLoading = useCallback(
    (traceId: string, spanId: string): boolean =>
      loadingMap.get(makeKey(traceId, spanId)) ?? false,
    [loadingMap, makeKey],
  );

  const getError = useCallback(
    (traceId: string, spanId: string): string | undefined =>
      errorMap.get(makeKey(traceId, spanId)),
    [errorMap, makeKey],
  );

  return {
    fetchSpanDetails,
    getDetails,
    isLoading,
    getError,
  };
}
