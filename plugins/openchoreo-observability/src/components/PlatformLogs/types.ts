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
