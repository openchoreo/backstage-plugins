import { calculateTimeRange } from '@openchoreo/backstage-plugin-react';
import {
  AUDIT_MAX_WINDOW_DAYS,
  AuditCategory,
  AuditFilterPath,
  AuditLogsQueryRequest,
  AuditQueryToken,
  AuditResult,
  AuditSurface,
} from './types';

/**
 * How many values each filter accepts server-side; one more is a 400, not a
 * wider query. The closed-set filters cap at the size of their own enum, so
 * only the open-valued ones can be reached by picking distinct values.
 */
const MAX_FILTER_VALUES = 20;
const FILTER_VALUE_CAPS: Partial<Record<AuditFilterPath, number>> = {
  'actor.type': 4,
  category: 3,
  result: 4,
  surface: 2,
};
/**
 * Bounds the free text, which the server accepts at any length. The phrase goes
 * into the query key, so an unbounded one would key the cache on an arbitrarily
 * long string.
 */
const MAX_SEARCH_PHRASE = 256;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The window a query covers, resolved from a preset or a custom range. */
export interface AuditWindow {
  startTime: string;
  endTime: string;
  /** True when a custom range was wider than the server accepts and was cut back. */
  clamped: boolean;
}

/**
 * Resolves the time window, clamped to the 366 days the observer accepts.
 * Clamping here rather than letting the user earn a `400`: the request is
 * still answerable, just over a narrower window, and the page says so.
 */
export function resolveAuditWindow(
  timeRange: string,
  custom?: { startTime?: string; endTime?: string },
): AuditWindow {
  const range = calculateTimeRange(timeRange, custom);
  // A hand-edited `from`/`to` pair can arrive either way round. Left reversed,
  // the span is negative, which skips the clamp below and earns a 400.
  const reversed =
    new Date(range.startTime).getTime() > new Date(range.endTime).getTime();
  const startTime = reversed ? range.endTime : range.startTime;
  const endTime = reversed ? range.startTime : range.endTime;

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const maxSpan = AUDIT_MAX_WINDOW_DAYS * DAY_MS;

  if (end - start > maxSpan) {
    return {
      startTime: new Date(end - maxSpan).toISOString(),
      endTime,
      clamped: true,
    };
  }
  return { startTime, endTime, clamped: false };
}

const take = (path: AuditFilterPath, values: string[]): string[] =>
  values.slice(0, FILTER_VALUE_CAPS[path] ?? MAX_FILTER_VALUES);

/**
 * Folds the query bar's tokens into the request body. Tokens sharing a path OR
 * within that field and different paths AND with each other, which is what the
 * body already means — so this is a regrouping, not a translation.
 */
export function tokensToFilters(
  tokens: AuditQueryToken[],
): Partial<AuditLogsQueryRequest> {
  const byPath = new Map<string, string[]>();
  const freeText: string[] = [];

  for (const token of tokens) {
    if (token.path === null) {
      freeText.push(token.value);
      continue;
    }
    const existing = byPath.get(token.path);
    if (existing) {
      if (!existing.includes(token.value)) existing.push(token.value);
    } else {
      byPath.set(token.path, [token.value]);
    }
  }

  const request: Partial<AuditLogsQueryRequest> = {};
  const actor: NonNullable<AuditLogsQueryRequest['actor']> = {};
  const resource: NonNullable<AuditLogsQueryRequest['resource']> = {};

  for (const [path, values] of byPath) {
    switch (path) {
      case 'actor.id':
        actor.id = take('actor.id', values);
        break;
      case 'actor.type':
        actor.type = take('actor.type', values);
        break;
      case 'actor.issuer':
        actor.issuer = take('actor.issuer', values);
        break;
      case 'actor.session_id':
        actor.session_id = take('actor.session_id', values);
        break;
      case 'actor.entitlements':
        actor.entitlements = take('actor.entitlements', values);
        break;
      case 'resource.type':
        resource.type = take('resource.type', values);
        break;
      case 'resource.namespace':
        resource.namespace = take('resource.namespace', values);
        break;
      case 'resource.environment':
        resource.environment = take('resource.environment', values);
        break;
      case 'resource.project':
        resource.project = take('resource.project', values);
        break;
      case 'resource.component':
        resource.component = take('resource.component', values);
        break;
      case 'resource.resource':
        resource.resource = take('resource.resource', values);
        break;
      case 'resource.name':
        resource.name = take('resource.name', values);
        break;
      case 'action':
        request.action = take('action', values);
        break;
      case 'category':
        request.category = take('category', values) as AuditCategory[];
        break;
      case 'result':
        request.result = take('result', values) as AuditResult[];
        break;
      case 'producer':
        request.producer = take('producer', values);
        break;
      case 'surface':
        request.surface = take('surface', values) as AuditSurface[];
        break;
      case 'operation_id':
        request.operation_id = take('operation_id', values);
        break;
      case 'source_ip':
        request.source_ip = take('source_ip', values);
        break;
      case 'user_agent':
        request.user_agent = take('user_agent', values);
        break;
      case 'event_id':
        request.event_id = take('event_id', values);
        break;
      case 'request_id':
        request.request_id = take('request_id', values);
        break;
      default:
        break;
    }
  }

  if (Object.keys(actor).length > 0) request.actor = actor;
  if (Object.keys(resource).length > 0) request.resource = resource;
  if (freeText.length > 0) {
    request.searchPhrase = freeText.join(' ').slice(0, MAX_SEARCH_PHRASE);
  }

  return request;
}

/** Builds a complete request body from a window, the tokens, and page controls. */
export function buildAuditQuery(args: {
  window: AuditWindow;
  tokens: AuditQueryToken[];
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}): AuditLogsQueryRequest {
  const { window, tokens, limit, sortOrder } = args;

  return {
    startTime: window.startTime,
    endTime: window.endTime,
    ...(limit !== undefined ? { limit } : {}),
    ...(sortOrder ? { sortOrder } : {}),
    ...tokensToFilters(tokens),
  };
}
