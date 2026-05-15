import { parseEntityRef, type Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import type { PrefetchedLogEntry } from '../api/PerchAgentApi';

/** Subset of a runtime log row the prefetched-logs helper reads. */
export interface PrefetchableLogRow {
  timestamp?: string;
  log?: string;
  level?: string;
  metadata?: {
    componentName?: string;
    environmentName?: string;
  };
}

/** Max rows we forward to the agent in ``scope.prefetchedLogs`` for the
 *  un-pinned "Ask Perch" path. Sized to mirror what the Logs tab
 *  renders per page so the agent's first-turn picture matches what the
 *  user is staring at. */
export const PREFETCHED_LOGS_MAX_ROWS = 50;
/** Tighter cap when the request is anchored to a specific row
 *  (``InvestigateLogButton``). The pinned line + a small ring of
 *  ERROR/WARN siblings is enough for the model — anything more is
 *  noise that pushes the actual evidence out of view. */
export const PREFETCHED_LOGS_MAX_ROWS_PINNED = 20;
/** Per-row message char cap — keeps the request body inside the
 *  agent's 60 000-char total content budget while preserving the
 *  actionable head of each line (request id, error code, stack frame). */
export const PREFETCHED_LOGS_MAX_MESSAGE_CHARS = 300;
/** ±window (ms) around ``pinnedTimestamp`` to keep rows from.
 *  2 minutes wide on each side — narrow enough to drop unrelated
 *  request access logs an hour earlier, wide enough to catch a
 *  cause that started 30-60 s before the symptom row. */
export const PREFETCHED_LOGS_PINNED_WINDOW_MS = 2 * 60 * 1000;
/** Severity allow-list applied ONLY in the pinned path. INFO/DEBUG
 *  request access logs drown out the actual ERROR/WARN siblings that
 *  diagnose a pinned line. The un-pinned path keeps the user's level
 *  selection as-is — they're seeing those rows on screen and the
 *  agent's picture should match. */
const PINNED_ALLOWED_LEVELS = new Set(['ERROR', 'WARN', 'WARNING']);

/** Optional pinned-row context. When set, ``buildPrefetchedLogs``
 *  narrows the snapshot to rows useful for diagnosing *this specific
 *  line*: drops INFO/DEBUG noise, keeps rows within
 *  ``PREFETCHED_LOGS_PINNED_WINDOW_MS`` of the pinned timestamp,
 *  always preserves the pinned row itself, and caps at
 *  ``PREFETCHED_LOGS_MAX_ROWS_PINNED``. */
export interface PrefetchedLogsPinContext {
  /** RFC3339 timestamp of the row the user clicked Investigate on. */
  timestamp?: string;
  /** First few hundred chars of the pinned row's message — used to
   *  identify the row in the snapshot so it survives filtering even
   *  if its level isn't ERROR/WARN. */
  message?: string;
  /** Trace id pulled from the pinned row's text, when present. Rows
   *  whose message contains this id are promoted (kept regardless of
   *  the time window) since they're causally linked to the pinned line. */
  traceId?: string;
}

function _toMillis(ts: string | undefined): number | undefined {
  if (!ts) return undefined;
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Transform observability log rows into the wire shape consumed by the
 * perch-agent. Strips fields the agent doesn't read, trims each
 * message, and caps the list size so the resulting JSON stays under
 * the agent's per-request content limit.
 *
 * Two operating modes:
 *
 * 1. **Un-pinned** (``pin`` omitted) — for the floating "Ask Perch"
 *    launcher on the Logs tab. Mirrors the visible page: up to
 *    ``PREFETCHED_LOGS_MAX_ROWS`` rows, no severity filtering, no
 *    time-window filtering. The user's level chips and time range
 *    already shape the input list before it gets here.
 *
 * 2. **Pinned** (``pin`` set) — for the per-row Investigate button.
 *    The user told us the exact line they care about, so we narrow to
 *    "rows that help diagnose *this* line":
 *      - Drop INFO/DEBUG; keep only ERROR/WARN/WARNING.
 *      - Drop rows further than ±2 min from the pinned timestamp.
 *      - Always keep the pinned row itself (matched by
 *        timestamp + message prefix) regardless of its level.
 *      - Promote rows whose message contains the pinned trace_id
 *        regardless of their severity / time-window — those are
 *        causally linked.
 *      - Cap at ``PREFETCHED_LOGS_MAX_ROWS_PINNED`` rows.
 *
 * Returns ``undefined`` when there are no usable rows so callers can
 * spread the result into ChatScope without writing an empty array
 * (which the agent would treat as "user explicitly cleared the table").
 */
export function buildPrefetchedLogs(
  rows: PrefetchableLogRow[] | undefined,
  opts?: {
    maxRows?: number;
    maxMessageChars?: number;
    /** When set, switches the helper into the pinned-narrowing mode
     *  described in the docstring. */
    pin?: PrefetchedLogsPinContext;
  },
): PrefetchedLogEntry[] | undefined {
  if (!rows || rows.length === 0) return undefined;
  const isPinned = opts?.pin !== undefined;
  const maxRows =
    opts?.maxRows ??
    (isPinned ? PREFETCHED_LOGS_MAX_ROWS_PINNED : PREFETCHED_LOGS_MAX_ROWS);
  const maxMsg = opts?.maxMessageChars ?? PREFETCHED_LOGS_MAX_MESSAGE_CHARS;

  // Pinned-mode narrowing predicates. Computed once outside the loop
  // to avoid per-row Date.parse and substring construction.
  const pinTimeMs = _toMillis(opts?.pin?.timestamp);
  // First 80 chars of the pinned message is enough to identify the
  // exact row in the snapshot — even very similar log lines diverge
  // within the first ~50 chars (different timestamps, request ids).
  // We don't use full equality because the FE trims messages to
  // ``maxMsg`` chars before sending, so the pinned message (which
  // came from the same FE pipeline) may already be a prefix.
  const pinMsgPrefix = opts?.pin?.message?.slice(0, 80);
  const pinTraceId = opts?.pin?.traceId;

  function matchesPinnedRow(row: PrefetchableLogRow): boolean {
    // Identifying the pinned row is opt-in by message. Timestamp on
    // its own is NOT a sufficient identifier — log indexers commonly
    // emit many rows at the same RFC3339 second (request access logs
    // burst at sub-millisecond intervals, the timestamp rounds to the
    // same second), so a timestamp-only match would wrongly grant
    // the severity-bypass to every row at the same second and the
    // INFO/DEBUG filter would never fire.
    //
    // Callers (today only InvestigateLogButton) pass the pinned
    // message so this branch identifies exactly one row.
    if (!isPinned || !pinMsgPrefix) return false;
    return Boolean(row.log && row.log.startsWith(pinMsgPrefix));
  }

  function rowPassesPinnedFilter(row: PrefetchableLogRow): boolean {
    if (!isPinned) return true;
    // The pinned row itself always survives — even when it's
    // WARN/INFO and the rest of the filter would drop it.
    if (matchesPinnedRow(row)) return true;
    // Trace-linked rows survive regardless of severity / time.
    if (pinTraceId && row.log && row.log.includes(pinTraceId)) return true;
    // Severity filter (case-insensitive on the row's reported level).
    const lvl = (row.level ?? '').toUpperCase();
    if (!PINNED_ALLOWED_LEVELS.has(lvl)) return false;
    // Time window filter — only enforced when we actually have a
    // pinned timestamp AND a parseable row timestamp to compare. If
    // either is missing or unparseable, keep the row: dropping an
    // ERROR/WARN that already cleared the severity filter just
    // because its timestamp string is malformed (older observer
    // releases occasionally emit ``"unknown"`` / blank strings)
    // would lose evidence the pinned-mode helper is specifically
    // meant to surface.
    if (pinTimeMs !== undefined && row.timestamp) {
      const rowMs = _toMillis(row.timestamp);
      if (
        rowMs !== undefined &&
        Math.abs(rowMs - pinTimeMs) > PREFETCHED_LOGS_PINNED_WINDOW_MS
      ) {
        return false;
      }
    }
    return true;
  }

  const filtered: PrefetchableLogRow[] = isPinned
    ? rows.filter(rowPassesPinnedFilter)
    : rows;

  const trimmed = filtered
    .slice(0, maxRows)
    .reduce<PrefetchedLogEntry[]>((acc, row) => {
      const raw = row.log ?? '';
      if (!raw) return acc;
      const entry: PrefetchedLogEntry = {
        message: raw.length > maxMsg ? raw.slice(0, maxMsg) : raw,
      };
      if (row.timestamp) entry.timestamp = row.timestamp;
      if (row.level) entry.level = row.level;
      if (row.metadata?.componentName) {
        entry.componentName = row.metadata.componentName;
      }
      if (row.metadata?.environmentName) {
        entry.environmentName = row.metadata.environmentName;
      }
      acc.push(entry);
      return acc;
    }, []);
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolve the OpenChoreo namespace for an entity. Priority:
 *   1. ``openchoreo.dev/namespace`` annotation (set by the catalog
 *      provider when the resource came from the OpenChoreo API).
 *   2. Backstage entity namespace.
 *   3. The entity's ``spec.domain`` ref (System → Domain), if the
 *      annotation is missing — for System entities the domain name
 *      doubles as the namespace.
 *   4. ``default`` as last-resort fallback.
 */
export function resolveEntityNamespace(entity: Entity): string {
  const annotated = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
  if (annotated) return annotated;
  if (entity.spec?.domain) {
    try {
      const domainRef = parseEntityRef(String(entity.spec.domain), {
        defaultKind: 'domain',
        defaultNamespace: 'default',
      });
      return domainRef.name;
    } catch {
      // fall through
    }
  }
  return entity.metadata.namespace ?? 'default';
}

/**
 * Parse the observability page's ``timeRange`` token (``10m`` / ``1h``
 * / ``24h`` / ``7d``) into minutes. Returns ``undefined`` for null,
 * empty, or malformed input so callers can apply their own default.
 */
export function parseRangeToMinutes(
  token: string | null | undefined,
): number | undefined {
  if (!token) return undefined;
  const match = /^(\d+)([mhd])$/.exec(token.trim());
  if (!match) return undefined;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const unit = match[2];
  if (unit === 'm') return n;
  if (unit === 'h') return n * 60;
  return n * 60 * 24;
}
