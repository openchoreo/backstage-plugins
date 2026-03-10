import type { AlertSummary } from '../../types';
import type { Environment } from '../RuntimeLogs/types';

export type { AlertSummary };
export type { Environment };

export interface AlertsFilters {
  environmentId: string;
  timeRange: string;
  sortOrder?: 'asc' | 'desc';
  severity?: string[];
  searchQuery?: string;
}

export const ALERTS_TIME_RANGE_OPTIONS = [
  { value: '10m', label: 'Last 10 minutes' },
  { value: '30m', label: 'Last 30 minutes' },
  { value: '1h', label: 'Last 1 hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
] as const;

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;
