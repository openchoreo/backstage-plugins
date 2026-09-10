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
  // The response is stored with the query key that produced it, so a result can
  // never be shown under a scope/window it does not belong to (for example when
  // the request for a newly selected scope fails and the previous one lingers).
  const [result, setResult] = useState<{
    key: string;
    data: DoraMetricsResponse;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  // Keyed for the same reason as `result`: without a key, an error outlives the
  // query that produced it. Clearing the scope early-returns from the effect
  // below without running the fetch, so an unkeyed error would stay on screen
  // with no active query behind it.
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken(token => token + 1), []);

  // Key on the scope's fields (not the object identity) so callers may pass
  // a fresh object literal on each render without causing refetch loops.
  const scopeKey = scope
    ? `${scope.namespace}/${scope.project ?? ''}/${scope.component ?? ''}/${
        scope.environment ?? ''
      }`
    : '';
  const queryKey = `${scopeKey}|${rangeDays}|${granularity}`;

  useEffect(() => {
    if (!scope) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;

    const fetchInsights = async () => {
      try {
        setLoading(true);
        setFailure(null);

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
          setResult({ key: queryKey, data: response });
        }
      } catch (err) {
        if (!cancelled) {
          setFailure({
            key: queryKey,
            message:
              err instanceof Error
                ? err.message
                : 'Failed to fetch DORA metrics',
          });
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

  // A stale result (a scope/window that has since changed) is withheld rather
  // than shown under the current selection. A failed *refresh* of the current
  // key keeps its last good data alongside the error, which is intended.
  const data = result?.key === queryKey ? result.data : null;
  // Same rule for the error: it belongs to the query that raised it. A failed
  // refresh of the current key still surfaces, because the key matches.
  const error = failure?.key === queryKey ? failure.message : null;

  return { data, loading, error, refetch };
}
