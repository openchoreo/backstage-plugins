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

/** Max rows we forward to the agent in ``scope.prefetchedLogs``. */
export const PREFETCHED_LOGS_MAX_ROWS = 50;
/** Per-row message char cap — keeps the request body inside the
 *  agent's 60 000-char total content budget while preserving the
 *  actionable head of each line (request id, error code, stack frame). */
export const PREFETCHED_LOGS_MAX_MESSAGE_CHARS = 300;

/**
 * Transform observability log rows into the wire shape consumed by the
 * perch-agent. Strips fields the agent doesn't read, trims each
 * message, and caps the list size so the resulting JSON stays under
 * the agent's per-request content limit.
 *
 * Returns ``undefined`` when there are no usable rows so callers can
 * spread the result into ChatScope without writing an empty array
 * (which the agent would treat as "user explicitly cleared the table").
 */
export function buildPrefetchedLogs(
  rows: PrefetchableLogRow[] | undefined,
  opts?: { maxRows?: number; maxMessageChars?: number },
): PrefetchedLogEntry[] | undefined {
  if (!rows || rows.length === 0) return undefined;
  const maxRows = opts?.maxRows ?? PREFETCHED_LOGS_MAX_ROWS;
  const maxMsg = opts?.maxMessageChars ?? PREFETCHED_LOGS_MAX_MESSAGE_CHARS;
  const trimmed = rows
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
