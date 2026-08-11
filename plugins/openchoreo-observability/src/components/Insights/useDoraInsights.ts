import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../../api/ObservabilityApi';
import {
  DoraGranularity,
  DoraMetricsResponse,
  DoraSearchScope,
} from '../../types';

export interface UseDoraInsightsResult {
  data: DoraMetricsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches DORA metrics for a scope and window. Refetches whenever the scope,
 * window, or granularity changes.
 */
export function useDoraInsights(
  scope: DoraSearchScope | null,
  rangeDays: number,
  granularity: DoraGranularity,
): UseDoraInsightsResult {
  const observabilityApi = useApi(observabilityApiRef);
  const [data, setData] = useState<DoraMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken(token => token + 1), []);

  // Key on the scope's fields (not the object identity) so callers may pass
  // a fresh object literal on each render without causing refetch loops.
  const scopeKey = scope
    ? `${scope.namespace}/${scope.project ?? ''}/${scope.component ?? ''}/${
        scope.environment ?? ''
      }`
    : '';

  useEffect(() => {
    if (!scope) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;

    const fetchInsights = async () => {
      try {
        setLoading(true);
        setError(null);

        const endTime = new Date();
        const startTime = new Date(
          endTime.getTime() - rangeDays * 24 * 60 * 60 * 1000,
        );

        const response = await observabilityApi.getDoraMetrics(scope, {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          granularity,
        });
        if (!cancelled) {
          setData(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch DORA metrics',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchInsights();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, rangeDays, granularity, reloadToken, observabilityApi]);

  return { data, loading, error, refetch };
}
