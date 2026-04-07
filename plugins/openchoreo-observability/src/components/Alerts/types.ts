export interface AlertsFilters {
  environment: string;
  timeRange: string;
  sortOrder?: 'asc' | 'desc';
  severity?: string[];
  searchQuery?: string;
}

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;
