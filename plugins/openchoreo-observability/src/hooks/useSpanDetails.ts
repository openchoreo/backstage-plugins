import { useCallback, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { SpanDetails } from '../types';

interface UseSpanDetailsOptions {
  namespaceName: string;
  environmentName: string;
}

export function useSpanDetails(options: UseSpanDetailsOptions) {
  const observabilityApi = useApi(observabilityApiRef);
  const [detailsMap, setDetailsMap] = useState<Map<string, SpanDetails>>(
    new Map(),
  );
  const [loadingMap, setLoadingMap] = useState<Map<string, boolean>>(new Map());
  const [errorMap, setErrorMap] = useState<Map<string, string>>(new Map());

  // Composite key for deduplication
  const makeKey = (traceId: string, spanId: string) => `${traceId}::${spanId}`;

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
          options.environmentName,
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
    [observabilityApi, options, loadingMap, detailsMap],
  );

  const getDetails = useCallback(
    (traceId: string, spanId: string): SpanDetails | undefined =>
      detailsMap.get(makeKey(traceId, spanId)),
    [detailsMap],
  );

  const isLoading = useCallback(
    (traceId: string, spanId: string): boolean =>
      loadingMap.get(makeKey(traceId, spanId)) ?? false,
    [loadingMap],
  );

  const getError = useCallback(
    (traceId: string, spanId: string): string | undefined =>
      errorMap.get(makeKey(traceId, spanId)),
    [errorMap],
  );

  return {
    fetchSpanDetails,
    getDetails,
    isLoading,
    getError,
  };
}
