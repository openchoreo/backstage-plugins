export interface AlertsFilters {
  environment: string;
  timeRange: string;
  /** ISO start time, used when `timeRange === 'custom'` */
  customStartTime?: string;
  /** ISO end time, used when `timeRange === 'custom'` */
  customEndTime?: string;
  sortOrder?: 'asc' | 'desc';
  severity?: string[];
  searchQuery?: string;
}

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;
