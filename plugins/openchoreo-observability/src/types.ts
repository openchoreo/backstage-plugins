import type {
  ObservabilityComponents,
  AIRCAAgentComponents,
} from '@openchoreo/backstage-plugin-common';

// Use generated types from OpenAPI spec
export type MetricsTimeSeriesItem =
  ObservabilityComponents['schemas']['MetricsTimeSeriesItem'];

export type CpuUsageMetrics = {
  cpuUsage: MetricsTimeSeriesItem[];
  cpuRequests: MetricsTimeSeriesItem[];
  cpuLimits: MetricsTimeSeriesItem[];
};

export type MemoryUsageMetrics = {
  memoryUsage: MetricsTimeSeriesItem[];
  memoryRequests: MetricsTimeSeriesItem[];
  memoryLimits: MetricsTimeSeriesItem[];
};

export type NetworkThroughputMetrics = {
  requestCount: MetricsTimeSeriesItem[];
  successfulRequestCount: MetricsTimeSeriesItem[];
  unsuccessfulRequestCount: MetricsTimeSeriesItem[];
};

export type NetworkLatencyMetrics = {
  meanLatency: MetricsTimeSeriesItem[];
  latencyP50: MetricsTimeSeriesItem[];
  latencyP90: MetricsTimeSeriesItem[];
  latencyP99: MetricsTimeSeriesItem[];
};

export type Metrics = {
  cpuUsage: CpuUsageMetrics;
  memoryUsage: MemoryUsageMetrics;
  networkThroughput: NetworkThroughputMetrics;
  networkLatency: NetworkLatencyMetrics;
};

export interface Span {
  durationNanoseconds: number;
  endTime: string;
  name: string;
  spanId: string;
  startTime: string;
  parentSpanId?: string;
}

export interface Trace {
  traceId: string;
  startTime: string;
  endTime: string;
  durationNanoseconds: number;
  numberOfSpans: number;
  spans: Span[];
}

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
  componentIds?: string[];
  searchQuery?: string;
  rcaStatus?: RCAStatus;
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

export type RCAStatus = 'pending' | 'completed' | 'failed';

export interface RCAStatusOption {
  value: RCAStatus;
  label: string;
}

export const RCA_STATUS_OPTIONS: RCAStatusOption[] = [
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

// Use generated types from AI RCA Agent API
export type RCAReportSummary =
  AIRCAAgentComponents['schemas']['RCAReportSummary'];
export type RCAReportDetailed =
  AIRCAAgentComponents['schemas']['RCAReportDetailed'];
