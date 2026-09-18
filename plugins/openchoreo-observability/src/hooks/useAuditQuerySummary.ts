import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { AuditQueryToken } from '../components/AuditLogs/types';
import { AuditWindow, buildAuditQuery } from '../components/AuditLogs/query';

export interface UseAuditQuerySummaryOptions {
  window: AuditWindow;
  tokens: AuditQueryToken[];
  isLive?: boolean;
  /**
   * Bumped by Refresh. Part of the query key because a custom window resolves
   * to the same two timestamps every time, so without it the key is unchanged
   * and `staleTime` answers a refresh from cache.
   */
  generation?: number;
  enabled?: boolean;
}

export interface UseAuditQuerySummaryResult {
  /** Matching records across the whole query, not the loaded page. */
  total: number;
  tookMs?: number;
  loading: boolean;
  isRefetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const LIVE_INTERVAL_MS = 10_000;

/**
 * Describes the query rather than the page: how many records match it.
 *
 * Kept apart from {@link useAuditLogs} so the count is requested once per
 * query, not once per loaded page.
 */
export function useAuditQuerySummary(
  options: UseAuditQuerySummaryOptions,
): UseAuditQuerySummaryResult {
  const observabilityApi = useApi(observabilityApiRef);
  const {
    window: auditWindow,
    tokens,
    isLive = false,
    generation = 0,
    enabled = true,
  } = options;

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    [
      'audit-logs-summary',
      auditWindow.startTime,
      auditWindow.endTime,
      JSON.stringify(tokens),
      generation,
    ],
    () => {
      // Same as the record query: while Live is on the window has to reach the
      // present, or the count stops at the moment Live was switched on.
      const window = isLive
        ? { ...auditWindow, endTime: new Date().toISOString() }
        : auditWindow;

      return observabilityApi.queryAuditLogs(
        buildAuditQuery({
          window,
          tokens,
          // No records are wanted here, and 0 is not an accepted limit.
          limit: 1,
        }),
      );
    },
    {
      enabled,
      refetchInterval: isLive ? LIVE_INTERVAL_MS : false,
      staleTime: 30_000,
      keepPreviousData: true,
    },
  );

  return {
    total: data?.total ?? 0,
    tookMs: data?.tookMs,
    loading,
    isRefetching,
    error,
    refetch,
  };
}
