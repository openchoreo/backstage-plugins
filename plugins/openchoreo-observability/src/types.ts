import type {
  ObservabilityComponents,
  AIRCAAgentComponents,
} from '@openchoreo/backstage-plugin-common';
import type { Environment } from '@openchoreo/backstage-plugin-react';

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

// OTel span status ({ code: 'ok' | 'error' | 'unset', message? }) from the spec.
export type SpanStatus = ObservabilityComponents['schemas']['SpanStatus'];

export interface Span {
  spanId: string;
  spanName: string;
  spanKind?: string;
  startTime: string;
  endTime: string;
  durationNs: number;
  parentSpanId?: string;
  status?: SpanStatus;
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

// ---------------------------------------------------------------------------
// Delivery Insights (DORA metrics)
// ---------------------------------------------------------------------------

export type DoraGranularity = 'daily' | 'weekly' | 'monthly';

export type DoraMetricName =
  | 'deploymentFrequency'
  | 'leadTime'
  | 'changeFailureRate'
  | 'mttr';

/** DORA performance tier for a summary value, computed by the observer. */
export type DoraClassification = 'Elite' | 'High' | 'Medium' | 'Low' | 'Unknown';

/** Scope of a DORA query: namespace-only = org level; add project/component to narrow. */
export interface DoraSearchScope {
  namespace: string;
  project?: string;
  component?: string;
  environment?: string;
}

export interface DoraFrequencySummary {
  total: number;
  perDay: number;
  classification: DoraClassification;
  /** Change vs the preceding window of equal length (%); null without a baseline. */
  deltaPct: number | null;
}

export interface DoraLeadTimeSummary {
  p50Ms: number | null;
  p95Ms: number | null;
  /** Fraction of deployments carrying commit provenance (lead-time input). */
  coverage: number;
  classification: DoraClassification;
  deltaPct: number | null;
}

export interface DoraChangeFailureRateSummary {
  rate: number;
  failed: number;
  total: number;
  classification: DoraClassification;
  deltaPct: number | null;
}

export interface DoraMttrSummary {
  meanMs: number | null;
  p50Ms: number | null;
  recoveries: number;
  classification: DoraClassification;
  deltaPct: number | null;
}

export interface DoraMetricsResponse {
  scope: DoraSearchScope;
  granularity: DoraGranularity;
  window: { startTime: string; endTime: string; generatedAt: string };
  summary: {
    deploymentFrequency?: DoraFrequencySummary;
    leadTime?: DoraLeadTimeSummary;
    changeFailureRate?: DoraChangeFailureRateSummary;
    mttr?: DoraMttrSummary;
  };
  series: {
    /** Zero-filled: one entry per bucket in the window. */
    deploymentFrequency?: { bucketStart: string; count: number }[];
    /** Only buckets with data appear. */
    leadTime?: {
      bucketStart: string;
      p50Ms: number;
      p75Ms: number;
      p95Ms: number;
    }[];
    /** Zero-filled: one entry per bucket in the window. */
    changeFailureRate?: {
      bucketStart: string;
      rate: number;
      failed: number;
      total: number;
    }[];
    /** Only buckets with data appear. */
    mttr?: {
      bucketStart: string;
      meanMs: number;
      p50Ms: number;
      count: number;
    }[];
  };
}

export interface DoraDeployment {
  deployedAt: string;
  projectName: string;
  componentName: string;
  environmentName: string;
  componentRelease: string;
  /** Full commit SHA; empty when provenance is missing. */
  commit: string;
  outcome: 'success' | 'failed' | 'in_progress';
  failedBy: string;
  failureReason: string;
  incidentId: string;
  leadTimeMs: number | null;
}

export interface DoraDeploymentsResponse {
  deployments: DoraDeployment[];
  totalCount: number;
  tookMs: number;
}
