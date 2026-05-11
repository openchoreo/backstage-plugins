export interface IncidentsFilters {
  environment: string;
  timeRange: string;
  /** ISO start time, used when `timeRange === 'custom'` */
  customStartTime?: string;
  /** ISO end time, used when `timeRange === 'custom'` */
  customEndTime?: string;
  components?: string[];
  sortOrder?: 'asc' | 'desc';
  status?: string[];
  searchQuery?: string;
}

export const INCIDENT_STATUSES = [
  'active',
  'acknowledged',
  'resolved',
] as const;
