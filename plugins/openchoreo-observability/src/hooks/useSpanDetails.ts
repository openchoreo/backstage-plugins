import { useCallback, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { SpanDetails } from '../types';

interface UseSpanDetailsOptions {
  namespaceName: string;
  projectName: string;
  environmentName: string;
  componentName?: string;
}

export function useSpanDetails(options: UseSpanDetailsOptions) {
  const observabilityApi = useApi(observabilityApiRef);
  const [detailsMap, setDetailsMap] = useState<Map<string, SpanDetails>>(
    new Map(),
  );
  const [loadingMap, setLoadingMap] = useState<Map<string, boolean>>(new Map());
  const [errorMap, setErrorMap] = useState<Map<string, string>>(new Map());

  // Composite key for deduplication. Scoped so switching components can't
  // reuse another scope's pending/error/details state.
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

  const fetchSpanDetails = useCallback(
    async (traceId: string, spanId: string) => {
      const key = makeKey(traceId, spanId);

      if (loadingMap.get(key) || detailsMap.has(key)) {
        return;
      }

      setLoadingMap(prev => new Map(prev).set(key, true));
      setErrorMap(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      try {
        const result = await observabilityApi.getSpanDetails(
          traceId,
          spanId,
          options.namespaceName,
          options.projectName,
          options.environmentName,
          options.componentName,
        );

        setDetailsMap(prev => new Map(prev).set(key, result));
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
    [observabilityApi, options, loadingMap, detailsMap, makeKey],
  );

  const getDetails = useCallback(
    (traceId: string, spanId: string): SpanDetails | undefined =>
      detailsMap.get(makeKey(traceId, spanId)),
    [detailsMap, makeKey],
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
