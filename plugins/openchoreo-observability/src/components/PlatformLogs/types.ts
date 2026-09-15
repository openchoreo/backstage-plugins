/**
 * A single platform log entry as returned by GET /api/v1alpha1/platform-logs.
 *
 * Carries the physical coordinates of the pod that produced it. Plane attribution
 * (`openchoreo.dev/plane`, `openchoreo.dev/plane-id`) is a pod label that is filtered
 * on rather than returned, so it does not appear here.
 */
export interface PlatformLogEntry {
  timestamp: string;
  log: string;
  level?: string;
  clusterInstance?: string;
  namespaceName?: string;
  podName?: string;
  containerName?: string;
  podIp?: string;
  nodeName?: string;
  containerImage?: string;
  /**
   * Pod labels on the record, keyed as Kubernetes spells them, so a key can be copied
   * out of the expanded row and pasted straight into the label filter.
   */
  labels?: Record<string, string>;
}

export interface PlatformLogsResponse {
  logs: PlatformLogEntry[];
  total: number;
  tookMs: number;
}

/** Query options accepted by `ObservabilityApi.getPlatformLogs`. */
export interface PlatformLogsQueryOptions {
  clusterInstances?: string[];
  namespaces?: string[];
  podNames?: string[];
  containerNames?: string[];
  /** Equality-based Kubernetes label selector, e.g. `openchoreo.dev/plane=controlplane`. */
  labels?: string;
  logLevels?: string[];
  searchQuery?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

/**
 * A filter whose values the observer can enumerate, named as the query parameter that
 * accepts it. Log levels are a fixed enum the client already knows, and labels are a
 * selector rather than a field with values, so neither is listed.
 */
export type PlatformLogFilterName =
  | 'clusterInstance'
  | 'namespace'
  | 'podName'
  | 'containerName';

/** One value a filter takes, with how many records carry it. */
export interface PlatformLogFilterValue {
  value: string;
  count: number;
}

/** The response of `GET /api/v1alpha1/platform-logs/filter-values`. */
export interface PlatformLogFilterValuesResponse {
  filter: string;
  /** Ordered by `count` descending, then `value` ascending. */
  values: PlatformLogFilterValue[];
  /** How many distinct values match, of which at most `maxValues` were returned. */
  totalValues: number;
  tookMs: number;
}

/**
 * Query options accepted by `ObservabilityApi.getPlatformLogFilterValues`.
 *
 * The record query minus paging - no records are returned, so there is nothing to page
 * or order - plus the filter to list and the knobs that shape the value list.
 */
export interface PlatformLogFilterValuesQueryOptions
  extends Omit<PlatformLogsQueryOptions, 'limit' | 'sortOrder'> {
  filter: PlatformLogFilterName;
  /** Narrows the values returned, where `searchQuery` narrows the records. */
  valueSearch?: string;
  maxValues?: number;
}

/**
 * The coordinate pickers, in the order they are shown: the name the observer knows each
 * filter by, the `PlatformLogsFilters` key holding its selections, and its label.
 *
 * Declared once so the row renders from it rather than from four near-identical blocks,
 * and so a filter name can never drift from the selections it reads.
 */
export const PLATFORM_LOG_FACETS = [
  {
    filter: 'clusterInstance',
    key: 'clusterInstances',
    label: 'Clusters',
  },
  { filter: 'namespace', key: 'namespaces', label: 'Namespaces' },
  { filter: 'podName', key: 'podNames', label: 'Pods' },
  { filter: 'containerName', key: 'containerNames', label: 'Containers' },
] as const satisfies ReadonlyArray<{
  filter: PlatformLogFilterName;
  key: keyof PlatformLogsFilters;
  label: string;
}>;

export interface PlatformLogsFilters {
  /** Name of the ObservabilityPlane entity to query. */
  observabilityPlane: string;
  selectedFields: PlatformLogField[];
  clusterInstances: string[];
  namespaces: string[];
  podNames: string[];
  containerNames: string[];
  labels: string;
  logLevel: string[];
  timeRange: string;
  /** ISO start time, used when `timeRange === 'custom'` */
  customStartTime?: string;
  /** ISO end time, used when `timeRange === 'custom'` */
  customEndTime?: string;
  searchQuery?: string;
  sortOrder?: 'asc' | 'desc';
  /** Poll for new entries. Only meaningful on a relative time range. */
  isLive?: boolean;
}

export type PlatformLogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export const PLATFORM_LOG_LEVELS: PlatformLogLevel[] = [
  'ERROR',
  'WARN',
  'INFO',
  'DEBUG',
];

export enum PlatformLogField {
  Timestamp = 'Timestamp',
  LogLevel = 'Level',
  Cluster = 'Cluster',
  Namespace = 'Namespace',
  Pod = 'Pod',
  Container = 'Container',
  Log = 'Log',
}

/**
 * Columns shown by default. Cluster is off unless the operator asks for it: with a
 * single-cluster install every row would carry the same value, and the space is better
 * spent on the message.
 */
export const DEFAULT_PLATFORM_LOG_FIELDS: PlatformLogField[] = [
  PlatformLogField.Timestamp,
  PlatformLogField.LogLevel,
  PlatformLogField.Namespace,
  PlatformLogField.Pod,
  PlatformLogField.Log,
];

/**
 * The label filter the page starts with. Control-plane logs are what an operator
 * debugging OpenChoreo itself reaches for first, and the value doubles as a worked
 * example of the selector syntax they will need next.
 */
export const DEFAULT_PLATFORM_LABEL_SELECTOR =
  'openchoreo.dev/plane=controlplane';
