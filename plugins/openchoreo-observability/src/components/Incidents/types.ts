export interface IncidentsFilters {
  environment: string;
  timeRange: string;
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
