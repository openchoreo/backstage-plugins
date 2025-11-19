import { ObservabilityComponents } from '@openchoreo/openchoreo-client-node';

// Use generated types from OpenAPI spec
type TimeValuePoint = ObservabilityComponents['schemas']['TimeValuePoint'];

export type CpuUsageMetrics = {
  cpuUsage: TimeValuePoint[];
  cpuRequests: TimeValuePoint[];
  cpuLimits: TimeValuePoint[];
};

export type MemoryUsageMetrics = {
  memoryUsage: TimeValuePoint[];
  memoryRequests: TimeValuePoint[];
  memoryLimits: TimeValuePoint[];
};

export type UsageMetrics = {
  cpuUsage: CpuUsageMetrics;
  memoryUsage: MemoryUsageMetrics;
};

export interface TimeRangeOption {
  value: string;
  label: string;
}

export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { value: '10m', label: 'Last 10 minutes' },
  { value: '30m', label: 'Last 30 minutes' },
  { value: '1h', label: 'Last 1 hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
];

export interface Filters {
  environment: Environment;
  timeRange: string;
}

export interface Environment {
  uid?: string;
  name: string;
  namespace: string;
  displayName?: string;
  description?: string;
  organization?: string;
  dataPlaneRef?: string;
  isProduction: boolean;
  dnsPrefix?: string;
  createdAt: string;
  status?: string;
}
