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

export type ResourceMetrics = {
  cpuUsage: CpuUsageMetrics;
  memoryUsage: MemoryUsageMetrics;
};

export type HttpMetrics = {
  networkThroughput: NetworkThroughputMetrics;
  networkLatency: NetworkLatencyMetrics;
};

export type MetricType = 'resource' | 'http';

export interface Span {
  spanId: string;
  spanName: string;
  spanKind?: string;
  startTime: string;
  endTime: string;
  durationNs: number;
  parentSpanId?: string;
  status?: 'ok' | 'error' | 'unset';
}

export interface SpanDetails extends Span {
  attributes?: Record<string, unknown>;
  resourceAttributes?: Record<string, unknown>;
}

export interface Trace {
  traceId: string;
  traceName?: string;
  spanCount: number;
  rootSpanId?: string;
  rootSpanName?: string;
  rootSpanKind?: string;
  startTime: string;
  endTime: string;
  durationNs: number;
  hasErrors?: boolean;
}

export interface Filters {
  environment: Environment;
  timeRange: string;
  /** ISO start time, used when `timeRange === 'custom'` */
  customStartTime?: string;
  /** ISO end time, used when `timeRange === 'custom'` */
  customEndTime?: string;
  components?: string[];
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
  dataPlaneRef?: { kind?: string; name?: string };
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

// Alerts & Incidents shared types

export interface AlertSummary {
  timestamp?: string;
  alertId: string;
  alertValue?: string;
  ruleName?: string;
  ruleDescription?: string;
  severity?: 'info' | 'warning' | 'critical';
  sourceType?: 'log' | 'metric';
  sourceQuery?: string;
  sourceMetric?: string;
  projectName?: string;
  componentName?: string;
  environmentName?: string;
  namespaceName?: string;
  notificationChannels?: string[];
  incidentEnabled?: boolean;
}

export interface IncidentSummary {
  incidentId: string;
  alertId: string;
  status: 'active' | 'acknowledged' | 'resolved';
  description?: string;
  notes?: string;
  timestamp?: string;
  triggeredAt?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  incidentTriggerAiRca?: boolean;
  incidentTriggerAiCostAnalysis?: boolean;
  projectName?: string;
  componentName?: string;
  environmentName?: string;
  namespaceName?: string;
}

// -- FinOps / Cost Analysis types (from finops-agent OpenAPI spec) --

export type FinOpsReportStatus = 'pending' | 'completed' | 'failed';

export interface FinOpsReportSummary {
  reportId: string;
  namespace: string;
  project: string;
  environment?: string | null;
  component?: string | null;
  timestamp: string;
  summary?: string | null;
  status: FinOpsReportStatus;
}

export interface FinOpsReportDetailed {
  reportId: string;
  namespace: string;
  project: string;
  environment?: string | null;
  component?: string | null;
  timestamp: string;
  status: FinOpsReportStatus;
  report?: FinOpsReport | null;
}

export interface FinOpsReport {
  component: string;
  namespace: string;
  project: string;
  analysis_period: string;
  budgeted_cost: CostBreakdown;
  actual_cost: CostBreakdown;
  resource_metrics: FinOpsResourceMetrics;
  overprovisioning: OverprovisioningAssessment;
  summary: string;
  investigation_path: InvestigationStep[];
  recommended_actions?: FinOpsRemediationAction[];
}

export interface CostBreakdown {
  total_cost: number;
  currency: string;
  is_estimated: boolean;
}

export interface FinOpsResourceMetrics {
  cpu_request?: string | null;
  cpu_limit?: string | null;
  cpu_actual_avg?: string | null;
  cpu_actual_peak?: string | null;
  memory_request?: string | null;
  memory_limit?: string | null;
  memory_actual_avg?: string | null;
  memory_actual_peak?: string | null;
  data_available?: boolean;
}

export interface OverprovisioningAssessment {
  is_overprovisioned: boolean;
  cpu_utilization_pct?: number | null;
  memory_utilization_pct?: number | null;
  analysis: string;
  recommendation?: ResourceRecommendation | null;
}

export interface ResourceRecommendation {
  cpu_request: string;
  cpu_limit: string;
  memory_request: string;
  memory_limit: string;
  rationale: string;
  release_binding?: string | null;
}

export interface FinOpsFieldChange {
  json_pointer: string;
  value: string | number | boolean;
}

export interface FinOpsResourceChange {
  release_binding: string;
  fields: FinOpsFieldChange[];
}

export interface FinOpsRemediationAction {
  description: string;
  rationale: string;
  status: 'revised' | 'applied' | 'dismissed';
  change: FinOpsResourceChange | null;
}

export interface InvestigationStep {
  action: string;
  outcome: string;
  rationale?: string | null;
}
