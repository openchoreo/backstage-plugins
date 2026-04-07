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
}

export const SELECTED_FIELDS = [
  LogEntryField.Timestamp,
  LogEntryField.LogLevel,
  LogEntryField.Log,
];
