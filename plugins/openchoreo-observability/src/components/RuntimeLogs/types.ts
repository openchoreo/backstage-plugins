import type { ObservabilityComponents } from '@openchoreo/openchoreo-client-node';

/**
 * A single component log entry as returned by POST /api/v1/logs/query.
 * Fields come from the ComponentLogEntry schema (new unified API).
 */
export type LogEntry = ObservabilityComponents['schemas']['ComponentLogEntry'];

export interface LogsResponse {
  logs: LogEntry[];
  /** Total number of matching logs (renamed from totalCount in old API) */
  total?: number;
  tookMs?: number;
}

export interface Environment {
  id: string;
  name: string;
  resourceName: string;
}

export interface RuntimeLogsFilters {
  logLevel: string[];
  selectedFields: LogEntryField[];
  environmentId: string;
  timeRange: string;
  searchQuery?: string;
  sortOrder?: 'asc' | 'desc';
  isLive?: boolean;
}

export interface RuntimeLogsPagination {
  hasMore: boolean;
  offset: number;
  limit: number;
}

export interface RuntimeLogsState {
  logs: LogEntry[];
  loading: boolean;
  error: string | null;
  filters: RuntimeLogsFilters;
  pagination: RuntimeLogsPagination;
}

export interface RuntimeLogsParams {
  componentId: string;
  componentName: string;
  environmentId: string;
  environmentName: string;
  logLevels: string[];
  startTime: string;
  endTime: string;
  limit?: number;
  offset?: number;
}

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export const TIME_RANGE_OPTIONS = [
  { value: '10m', label: 'Last 10 minutes' },
  { value: '30m', label: 'Last 30 minutes' },
  { value: '1h', label: 'Last 1 hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
] as const;

export const LOG_LEVELS: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

export enum LogEntryField {
  Timestamp = 'Timestamp',
  Log = 'Log',
  LogLevel = 'LogLevel',
}

export const SELECTED_FIELDS = [
  LogEntryField.Timestamp,
  LogEntryField.LogLevel,
  LogEntryField.Log,
];
