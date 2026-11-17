import type { ComponentLogEntry } from '@openchoreo/backstage-plugin-common';

/**
 * A single component log entry as returned by POST /api/v1/logs/query.
 * Fields come from the ComponentLogEntry schema (new unified API).
 */
export type LogEntry = ComponentLogEntry;

export interface LogsResponse {
  logs: LogEntry[];
  /** Total number of matching logs (renamed from totalCount in old API) */
  total?: number;
  tookMs?: number;
}

export interface RuntimeLogsFilters {
  logLevel: string[];
  selectedFields: LogEntryField[];
  environment: string;
  timeRange: string;
  /** ISO start time, used when `timeRange === 'custom'` */
  customStartTime?: string;
  /** ISO end time, used when `timeRange === 'custom'` */
  customEndTime?: string;
  components?: string[];
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
  componentName: string;
  environmentName: string;
  logLevels: string[];
  startTime: string;
  endTime: string;
  limit?: number;
  offset?: number;
}

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

export const LOG_LEVELS: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

export enum LogEntryField {
  Timestamp = 'Timestamp',
  Log = 'Log',
  LogLevel = 'LogLevel',
  ComponentName = 'Component Name',
  ReleaseLine = 'Release Line',
}

export const SELECTED_FIELDS = [
  LogEntryField.Timestamp,
  LogEntryField.LogLevel,
  LogEntryField.Log,
];

/**
 * The fields the column selector offers, in column order. All of them show by
 * default. The release line column is offered when the logs cover every line
 * of a component with release lines, and the component name column on
 * project-level logs.
 */
export function selectableFields({
  releaseLine = false,
  componentName = false,
} = {}): LogEntryField[] {
  return [
    LogEntryField.Timestamp,
    LogEntryField.LogLevel,
    ...(componentName ? [LogEntryField.ComponentName] : []),
    ...(releaseLine ? [LogEntryField.ReleaseLine] : []),
    LogEntryField.Log,
  ];
}

/** Fields shown wherever they are offered. The selector lists them checked and disabled. */
export const FIXED_FIELDS = [LogEntryField.ComponentName, LogEntryField.Log];
