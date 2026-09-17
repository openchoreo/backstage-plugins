/**
 * Audit trail types, from the observer's `AuditLogs` operations
 * (`POST /api/v1alpha1/audit-logs/query` and `/filter-values`).
 *
 * Record fields keep their snake_case spelling and the query's own controls
 * stay camelCase, exactly as the spec has them: the record is the frozen,
 * versioned line a SIEM already consumes, so a response can be compared
 * against an exported log line key for key.
 */

/** Who performed the action. `id` is unique only within `issuer`. */
export interface AuditLogActor {
  type: string;
  id: string;
  issuer?: string;
  /** The token's `sid` claim. Absent for client-credentials tokens. */
  session_id?: string;
  /** Entitlement claims the token carried, keyed by claim name. */
  entitlements?: Record<string, string[]>;
}

/** The request line. Absent for an MCP `tools/call`, which has none. */
export interface AuditLogHttpInfo {
  method?: string;
  path?: string;
}

/** The target resource and the point in the tree authorization evaluated at. */
export interface AuditLogResource {
  type?: string;
  namespace?: string;
  /** Dual-scoped `{namespace}/{name}`, as authorization evaluated it. */
  environment?: string;
  project?: string;
  component?: string;
  resource?: string;
  /** Absent when the operation returned no object — a delete, or a non-CRUD mutation. */
  uid?: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

/** Where the record was collected, as stamped by the collector. */
export interface AuditLogCollectorInfo {
  namespaceName?: string;
  podName?: string;
  containerName?: string;
}

/** One audit event, in the field names and nesting it was published with. */
export interface AuditLogRecord {
  schema_version: string;
  event_id: string;
  event_time: string;
  actor: AuditLogActor;
  /** Empty string on a rejection that resolved no operation. */
  action: string;
  /** `management`, `authorization` or `access` at schema 1.0. */
  category: string;
  /** `success`, `failure` or `denied` at schema 1.0. */
  result: string;
  request_id?: string;
  source_ip?: string;
  user_agent?: string;
  producer?: string;
  /** `rest` or `mcp` at schema 1.0. */
  surface?: string;
  operation_id?: string;
  http?: AuditLogHttpInfo;
  /** `null` on an event with no resource — the key is published either way. */
  resource?: AuditLogResource | null;
  metadata?: Record<string, unknown>;
  collector?: AuditLogCollectorInfo;
  /** The raw collected line, when the storage backend retains it. */
  log?: string;
}

/** Filters on the record's `actor` group, named and nested as the record is. */
export interface AuditLogsActorFilter {
  id?: string[];
  type?: string[];
  issuer?: string[];
  session_id?: string[];
  entitlements?: string[];
}

/**
 * Filters on the record's `resource` group. These narrow the result set and
 * never widen authorization.
 *
 * `uid` has no filter: it is absent on deletes, so filtering by it would exclude
 * the operations an investigation most often wants.
 */
export interface AuditLogsResourceFilter {
  type?: string[];
  namespace?: string[];
  /** Dual-scoped `{namespace}/{name}`; a bare environment name will not match. */
  environment?: string[];
  project?: string[];
  component?: string[];
  /**
   * The OpenChoreo Resource in the hierarchy, the sibling of `component`. On a
   * release or binding this is the parent Resource, not the object `name`
   * records.
   */
  resource?: string[];
  name?: string[];
}

export type AuditSortOrder = 'asc' | 'desc';
export type AuditResult = 'success' | 'failure' | 'denied';

export const AUDIT_CATEGORIES = [
  'management',
  'authorization',
  'access',
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_SURFACES = ['rest', 'mcp'] as const;
export type AuditSurface = (typeof AUDIT_SURFACES)[number];

/**
 * A filter set over the trail. Multi-value fields OR within a field; fields AND
 * with each other, and an absent field is not a filter.
 */
export interface AuditLogsQueryRequest {
  /** Inclusive lower bound, RFC 3339 absolute UTC. At most 366 days before `endTime`. */
  startTime: string;
  /** Exclusive upper bound, strictly greater than `startTime`. */
  endTime: string;
  limit?: number;
  sortOrder?: AuditSortOrder;
  includeTimeline?: boolean;
  /** `<count><unit>` where unit is m, h, d or w. The server may coarsen it. */
  timelineInterval?: string;
  actor?: AuditLogsActorFilter;
  resource?: AuditLogsResourceFilter;
  action?: string[];
  category?: AuditCategory[];
  result?: AuditResult[];
  producer?: string[];
  surface?: AuditSurface[];
  operation_id?: string[];
  request_id?: string[];
  event_id?: string[];
  source_ip?: string[];
  user_agent?: string[];
  searchPhrase?: string;
}

/** One interval of the timeline. A result with no records may be omitted. */
export interface AuditLogTimelineBucket {
  startTime: string;
  total: number;
  counts?: Record<string, number>;
}

export interface AuditLogTimeline {
  /** The width actually used, which is not necessarily the one requested. */
  interval: string;
  buckets: AuditLogTimelineBucket[];
}

export interface AuditLogsResponse {
  records: AuditLogRecord[];
  /**
   * Every record matching the query across the window, not the number returned
   * — `records` holds at most `limit`. Exact rather than an estimate, so the
   * two can be compared to tell whether the window holds more than one page.
   */
  total: number;
  tookMs: number;
  timeline?: AuditLogTimeline;
}

/** One value a filter takes, with how many records carry it. */
export interface AuditLogFilterValue {
  value: string;
  /** May be approximate — an ordering hint, never an audit finding. */
  count: number;
}

export interface AuditLogFilterValuesRequest {
  query: AuditLogsQueryRequest;
  filter: AuditFilterPath;
  /** Narrows the values returned, as a picker's user types. */
  valueSearch?: string;
  maxValues?: number;
}

export interface AuditLogFilterValuesResponse {
  filter: string;
  values: AuditLogFilterValue[];
  /** How many distinct values match, of which at most `maxValues` were returned. */
  totalValues: number;
  tookMs: number;
}

/**
 * The filters whose values `/filter-values` can list, named by their path in
 * the query body.
 */
export const AUDIT_PICKABLE_FILTERS = [
  'actor.id',
  'actor.type',
  'actor.issuer',
  'actor.session_id',
  'actor.entitlements',
  'resource.type',
  'resource.namespace',
  'resource.environment',
  'resource.project',
  'resource.component',
  'resource.resource',
  'resource.name',
  'action',
  'category',
  'result',
  'producer',
  'surface',
  'operation_id',
  'source_ip',
  'user_agent',
] as const;

export type AuditPickableFilter = (typeof AUDIT_PICKABLE_FILTERS)[number];

/**
 * Filters the query accepts but `/filter-values` cannot list: both are
 * near-unique per record, so there is no list to pick from — a caller filters
 * them by an exact value already in hand, off a log line or another record.
 */
export const AUDIT_EXACT_ONLY_FILTERS = ['event_id', 'request_id'] as const;

export type AuditExactOnlyFilter = (typeof AUDIT_EXACT_ONLY_FILTERS)[number];

/** Every filter path the query bar offers. */
export type AuditFilterPath = AuditPickableFilter | AuditExactOnlyFilter;

export const AUDIT_FILTER_PATHS: AuditFilterPath[] = [
  ...AUDIT_PICKABLE_FILTERS,
  ...AUDIT_EXACT_ONLY_FILTERS,
];

export function isPickableFilter(
  path: AuditFilterPath,
): path is AuditPickableFilter {
  return (AUDIT_PICKABLE_FILTERS as readonly string[]).includes(path);
}

/**
 * What each filter names, shown beside it in the query bar. These describe the
 * recorded field rather than restating its path, so "issuer" explains why it
 * matters next to `actor.id`.
 */
export const AUDIT_FILTER_DESCRIPTIONS: Record<AuditFilterPath, string> = {
  'actor.id': 'the token’s validated sub claim — unique only within the issuer',
  'actor.type': 'kind of subject: user, service account or anonymous',
  'actor.issuer': 'the token’s iss claim — what makes an actor id unique',
  'actor.session_id': 'the token’s sid claim, joining one login’s actions',
  'actor.entitlements': 'an entitlement value, e.g. a group name',
  'resource.type': 'kind of thing that was acted on',
  'resource.namespace': 'the namespace authorization evaluated in',
  'resource.environment':
    'namespace-qualified environment, e.g. default/production',
  'resource.project': 'the project the decision was authorized at',
  'resource.component': 'the component the decision was authorized at',
  'resource.resource':
    'the Resource the decision was authorized at, the sibling of component',
  'resource.name': 'name the handler recorded',
  action: 'semantic action name policy is written against',
  category: 'management, authorization or access',
  result: 'outcome of the call',
  producer: 'the service that emitted the record',
  surface: 'which surface the call arrived through — rest or mcp',
  operation_id: 'canonical operation identifier',
  source_ip: 'client address the request arrived from',
  user_agent: 'the client as it identified itself — a claim, not proof',
  event_id: 'a record’s own id, for fetching one you already know',
  request_id: 'correlation id shared with the access log line',
};

/**
 * One filter selection. `path` is the field, `value` the selected value;
 * `path: null` is free text, which goes to `searchPhrase`.
 */
export interface AuditQueryToken {
  path: AuditFilterPath | null;
  value: string;
}

/** Columns the table can show. `fixed` columns cannot be turned off. */
export interface AuditColumn {
  id: string;
  label: string;
  /** The record field(s) the column renders, shown in the column picker. */
  field: string;
  fixed?: boolean;
  /** Shown unless the user says otherwise. */
  defaultOn?: boolean;
}

export const AUDIT_COLUMNS: AuditColumn[] = [
  { id: 'time', label: 'Time', field: 'event_time', fixed: true },
  { id: 'actor', label: 'Actor', field: 'actor.id + actor.type', fixed: true },
  { id: 'action', label: 'Action', field: 'action', fixed: true },
  {
    id: 'resource',
    label: 'Resource',
    field: 'resource.name + resource.type',
    fixed: true,
  },
  {
    id: 'scope',
    label: 'Scope',
    field: 'resource.namespace / project / component',
    defaultOn: true,
  },
  { id: 'result', label: 'Result', field: 'result', fixed: true },
  { id: 'surface', label: 'Surface', field: 'surface', defaultOn: true },
  { id: 'category', label: 'Category', field: 'category' },
  { id: 'operation', label: 'Operation ID', field: 'operation_id' },
  { id: 'environment', label: 'Environment', field: 'resource.environment' },
  { id: 'producer', label: 'Producer', field: 'producer' },
  { id: 'request', label: 'Request ID', field: 'request_id' },
  { id: 'ip', label: 'Source IP', field: 'source_ip' },
  { id: 'ua', label: 'Client', field: 'user_agent' },
  { id: 'http', label: 'Request line', field: 'http.method + http.path' },
];

export const AUDIT_DEFAULT_COLUMNS = AUDIT_COLUMNS.filter(
  c => c.fixed || c.defaultOn,
).map(c => c.id);

/** The three outcomes. Closed at schema 1.0. */
export const AUDIT_RESULTS: Array<{
  id: AuditResult;
  label: string;
}> = [
  { id: 'success', label: 'Successful' },
  { id: 'failure', label: 'Failed' },
  { id: 'denied', label: 'Denied' },
];

/**
 * The fields whose filter takes an enum rather than free text. The server
 * rejects a value outside the set, so such a filter is a failed request rather
 * than a narrower query.
 */
const CLOSED_FILTER_VALUES: Partial<
  Record<AuditFilterPath, readonly string[]>
> = {
  category: AUDIT_CATEGORIES,
  result: AUDIT_RESULTS.map(result => result.id),
  surface: AUDIT_SURFACES,
};

/** Whether `value` is one this filter accepts. Open-valued fields take any. */
export function isSupportedFilterValue(
  path: AuditFilterPath,
  value: string,
): boolean {
  const allowed = CLOSED_FILTER_VALUES[path];
  return !allowed || allowed.includes(value);
}

/** The window the query covers, at most 366 days wide. */
export const AUDIT_MAX_WINDOW_DAYS = 366;

export interface AuditLogsFilters {
  tokens: AuditQueryToken[];
  timeRange: string;
  customStartTime?: string;
  customEndTime?: string;
  columns: string[];
  sortOrder: AuditSortOrder;
  /** The record whose detail drawer is open, by `event_id`. */
  selectedEventId?: string;
}
