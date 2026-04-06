import type { IncidentSummary } from '../../types';

export type { IncidentSummary };

export interface IncidentsFilters {
  environment: string;
  timeRange: string;
  components?: string[];
  sortOrder?: 'asc' | 'desc';
  status?: string[];
  searchQuery?: string;
}

export const INCIDENTS_TIME_RANGE_OPTIONS = [
  { value: '10m', label: 'Last 10 minutes' },
  { value: '30m', label: 'Last 30 minutes' },
  { value: '1h', label: 'Last 1 hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
] as const;

export const INCIDENT_STATUSES = [
  'active',
  'acknowledged',
  'resolved',
] as const;
