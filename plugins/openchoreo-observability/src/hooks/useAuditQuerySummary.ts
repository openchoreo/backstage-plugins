import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { observabilityApiRef } from '../api/ObservabilityApi';
import {
  AuditLogTimeline,
  AuditQueryToken,
} from '../components/AuditLogs/types';
import {
  AuditWindow,
  buildAuditQuery,
  suggestTimelineInterval,
} from '../components/AuditLogs/query';

export interface UseAuditQuerySummaryOptions {
  window: AuditWindow;
  tokens: AuditQueryToken[];
  /** Ask for the histogram too. Costs an aggregation pass, so it is opt-in. */
  includeTimeline?: boolean;
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
  /** Absent means "unknown" — the adapter could not compute it, not "no activity". */
  timeline?: AuditLogTimeline;
  tookMs?: number;
  loading: boolean;
  isRefetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const LIVE_INTERVAL_MS = 10_000;

/**
 * Describes the query rather than the page: how many records match it, and —
 * when asked — the per-interval histogram.
 *
 * Kept apart from {@link useAuditLogs} because a page of records cannot be
 * bucketed into a timeline: a page is the newest `limit` records, not a sample
 * of the window. One request per query, not per page, and none at all for the
 * histogram while the chart is collapsed.
 */
export function useAuditQuerySummary(
  options: UseAuditQuerySummaryOptions,
): UseAuditQuerySummaryResult {
  const observabilityApi = useApi(observabilityApiRef);
  const {
    window: auditWindow,
    tokens,
    includeTimeline = false,
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
      includeTimeline,
      isLive,
      generation,
    ],
    () => {
      // Same as the record query: while Live is on the window has to reach the
      // present, or the count and the timeline stop at the moment Live was
      // switched on. The bucket width still comes from the pinned window, so
      // the chart's bars do not resize under the cursor on every poll.
      const window = isLive
        ? { ...auditWindow, endTime: new Date().toISOString() }
        : auditWindow;

      return observabilityApi.queryAuditLogs(
        buildAuditQuery({
          window,
          tokens,
          // No records are wanted here, and 0 is not an accepted limit.
          limit: 1,
          includeTimeline,
          timelineInterval: includeTimeline
            ? suggestTimelineInterval(
                auditWindow.startTime,
                auditWindow.endTime,
              )
            : undefined,
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
    timeline: data?.timeline,
    tookMs: data?.tookMs,
    loading,
    isRefetching,
    error,
    refetch,
  };
}
