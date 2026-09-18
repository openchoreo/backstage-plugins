import { useMemo } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoInfiniteQuery } from '@openchoreo/backstage-plugin-react';
import { observabilityApiRef } from '../api/ObservabilityApi';
import {
  AuditLogRecord,
  AuditQueryToken,
  AuditSortOrder,
} from '../components/AuditLogs/types';
import { AuditWindow, buildAuditQuery } from '../components/AuditLogs/query';

/** Page size. The API caps a page at 1000; 100 keeps a page cheap to render. */
export const AUDIT_PAGE_SIZE = 100;

const LIVE_INTERVAL_MS = 10_000;

/**
 * The window for one page: the full window on the first request, then closed up
 * to `boundary` — the `event_time` of the last record already read.
 */
function windowFrom(
  full: AuditWindow,
  sortOrder: AuditSortOrder,
  boundary: string | undefined,
): AuditWindow {
  if (!boundary) return full;
  return sortOrder === 'desc'
    ? { ...full, endTime: boundary }
    : { ...full, startTime: boundary };
}

/** Whether continuing at `boundary` leaves a window the server will accept. */
function movesWindow(
  current: AuditWindow,
  sortOrder: AuditSortOrder,
  boundary: string,
): boolean {
  const at = new Date(boundary).getTime();
  if (Number.isNaN(at)) return false;
  return sortOrder === 'desc'
    ? at > new Date(current.startTime).getTime()
    : at < new Date(current.endTime).getTime();
}

export interface UseAuditLogsOptions {
  window: AuditWindow;
  tokens: AuditQueryToken[];
  sortOrder: AuditSortOrder;
  /** Poll the newest page. Paging deeper is not offered while this is on. */
  isLive?: boolean;
  /**
   * Bumped by Refresh. Part of the query key because a custom window resolves
   * to the same two timestamps every time, so without it the key is unchanged
   * and `staleTime` answers a refresh from cache. Re-keying also drops the
   * pages already loaded, which is what a refresh means here: the walk starts
   * again from the whole window rather than resuming mid-scroll.
   */
  generation?: number;
  limit?: number;
  /** Folded into `enabled` — e.g. the audit-logs-view permission check. */
  enabled?: boolean;
}

export interface UseAuditLogsResult {
  records: AuditLogRecord[];
  loading: boolean;
  loadingMore: boolean;
  isRefetching: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => Promise<void>;
}

/**
 * Reads the audit trail a page at a time by walking the time window: the API
 * has no continuation token, so a page is continued by closing the window up to
 * the last record it returned — `endTime` down when descending, `startTime` up
 * when ascending.
 *
 * The window is half-open, `[startTime, endTime)`. Descending therefore never
 * repeats a record, but cannot reach records sharing the boundary's exact
 * `event_time` beyond a page's `limit`; ascending reaches all of them and
 * repeats the boundary record instead, which is why the rows are de-duplicated
 * by `event_id` below. That asymmetry is the contract's, not this hook's.
 *
 * The matching count lives in {@link useAuditQuerySummary} rather than here: it
 * describes the whole query while these pages describe a walk through it.
 *
 * Live mode polls the newest page rather than re-reading every page loaded so
 * far — one request a tick instead of one per page — so `hasMore` is withheld
 * while it is on and the list stays a single page. `isLive` is deliberately not
 * part of the query key: turning Live off must only stop the polling and leave
 * the records it fetched on screen. The caller bumps `generation` when Live is
 * turned on, so it lands on the newest page rather than re-fetching a deep
 * scroll position.
 */
export function useAuditLogs(options: UseAuditLogsOptions): UseAuditLogsResult {
  const observabilityApi = useApi(observabilityApiRef);
  const {
    window: auditWindow,
    tokens,
    sortOrder,
    isLive = false,
    generation = 0,
    limit = AUDIT_PAGE_SIZE,
    enabled = true,
  } = options;

  const {
    items,
    loading,
    loadingMore,
    isRefetching,
    error,
    hasMore,
    loadMore,
    refresh,
  } = useOpenChoreoInfiniteQuery<AuditLogRecord>(
    [
      'audit-logs',
      auditWindow.startTime,
      auditWindow.endTime,
      JSON.stringify(tokens),
      sortOrder,
      limit,
      generation,
    ],
    async boundary => {
      // Live has to ask for a window that reaches the present. `auditWindow` is
      // resolved once per generation, so its `endTime` is already in the past
      // by the first poll and an event recorded since would never fall inside
      // it. Only the bound moves; the query key does not, so polling does not
      // reset the pages already read.
      const source = isLive
        ? { ...auditWindow, endTime: new Date().toISOString() }
        : auditWindow;
      const pageWindow = windowFrom(source, sortOrder, boundary);
      const response = await observabilityApi.queryAuditLogs(
        buildAuditQuery({ window: pageWindow, tokens, limit, sortOrder }),
      );

      const records = response.records;
      const nextBoundary =
        records.length > 0 ? records[records.length - 1].event_time : undefined;

      return {
        items: records,
        hasMore: Boolean(
          nextBoundary &&
            records.length >= limit &&
            // The next window must still be a legal one: `endTime` has to stay
            // strictly greater than `startTime` or the request is a 400.
            movesWindow(pageWindow, sortOrder, nextBoundary) &&
            // A tie group wider than one page leaves the boundary where it was,
            // and asking again would return the same records forever.
            nextBoundary !== boundary,
        ),
        ...(nextBoundary ? { nextCursor: nextBoundary } : {}),
      };
    },
    {
      pageSize: limit,
      // Unused: the fetcher decides whether a next page exists and publishes the
      // window boundary as `nextCursor`, which the wrapper prefers.
      getCursor: () => undefined,
      enabled,
      refetchInterval: isLive ? LIVE_INTERVAL_MS : false,
      // The trail is append-only, so a page already read cannot change.
      staleTime: 30_000,
    },
  );

  // Ascending pages overlap by one record, because `startTime` is inclusive and
  // the boundary is the last record already read. The table keys rows by
  // `event_id`, so a repeat is a duplicate key rather than a cosmetic one.
  const records = useMemo(() => {
    if (sortOrder !== 'asc') return items;
    const seen = new Set<string>();
    return items.filter(record => {
      if (seen.has(record.event_id)) return false;
      seen.add(record.event_id);
      return true;
    });
  }, [items, sortOrder]);

  return {
    records,
    loading,
    loadingMore,
    isRefetching,
    error,
    hasMore: isLive ? false : hasMore,
    loadMore,
    refresh,
  };
}
