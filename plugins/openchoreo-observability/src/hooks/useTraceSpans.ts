import { useCallback, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
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

export function useTraceSpans(options: UseTraceSpansOptions) {
  const observabilityApi = useApi(observabilityApiRef);
  const [spansMap, setSpansMap] = useState<Map<string, Span[]>>(new Map());
  const [loadingMap, setLoadingMap] = useState<Map<string, boolean>>(new Map());
  const [errorMap, setErrorMap] = useState<Map<string, string>>(new Map());

  const fetchSpans = useCallback(
    async (traceId: string) => {
      // Already loaded or loading
      if (loadingMap.get(traceId) || spansMap.has(traceId)) {
        return;
      }

      setLoadingMap(prev => new Map(prev).set(traceId, true));
      setErrorMap(prev => {
        const next = new Map(prev);
        next.delete(traceId);
        return next;
      });

      try {
        const result = await observabilityApi.getTraceSpans(
          traceId,
          options.namespaceName,
          options.projectName,
          options.environmentName,
          options.componentName,
          {
            startTime: options.startTime,
            endTime: options.endTime,
          },
        );

        setSpansMap(prev => new Map(prev).set(traceId, result.spans));
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
    [observabilityApi, options, loadingMap, spansMap],
  );

  const getSpans = useCallback(
    (traceId: string): Span[] | undefined => spansMap.get(traceId),
    [spansMap],
  );

  const isLoading = useCallback(
    (traceId: string): boolean => loadingMap.get(traceId) ?? false,
    [loadingMap],
  );

  const getError = useCallback(
    (traceId: string): string | undefined => errorMap.get(traceId),
    [errorMap],
  );

  const clearSpans = useCallback((traceId: string) => {
    setSpansMap(prev => {
      const next = new Map(prev);
      next.delete(traceId);
      return next;
    });
  }, []);

  return {
    fetchSpans,
    getSpans,
    isLoading,
    getError,
    clearSpans,
  };
}
