import type { Environment } from '../RuntimeLogs/types';

export type { Environment };

export type TriggerStatus = 'succeeded' | 'failed' | 'running' | 'unknown';

export interface TriggerEvent {
  reason: string;
  message: string;
  timestamp: string;
  type: 'Normal' | 'Warning';
}

export interface Trigger {
  jobName: string;
  status: TriggerStatus;
  startTime: string;
  completionTime?: string;
  eventCount: number;
  events?: TriggerEvent[];
}

export interface TriggersQueryResponse {
  triggers: Trigger[];
  total: number;
  tookMs: number;
}

export type RetryStatus = 'Succeeded' | 'Failed' | 'Running' | 'Unknown';

export interface RetryEvent {
  reason: string;
  message: string;
  timestamp: string;
  type: 'Normal' | 'Warning';
}

export interface Retry {
  podName: string;
  status: RetryStatus;
  startTime: string;
  eventCount: number;
  events?: RetryEvent[];
}

export interface RetriesQueryResponse {
  retries: Retry[];
  total: number;
  tookMs: number;
}

export interface TriggersFilters {
  environmentId: string;
  timeRange: string;
  sortOrder: 'asc' | 'desc';
  page: number;
}

export const TRIGGERS_TIME_RANGE_OPTIONS = [
  { value: '1h', label: 'Last 1 hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
] as const;

export const TRIGGERS_PAGE_SIZE = 20;
