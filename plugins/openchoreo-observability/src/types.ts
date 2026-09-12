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

/** The four component-level series shapes, each keyed by fixed metric names. */
export type ComponentSeriesMap =
  | CpuUsageMetrics
  | MemoryUsageMetrics
  | NetworkThroughputMetrics
  | NetworkLatencyMetrics;

/** `metricKey -> points` for one component, e.g. `{ cpuUsage: [...] }`. */
export type MetricSeriesMap = Record<string, MetricsTimeSeriesItem[]>;

/**
 * `componentName -> that component's series`, the shape the project breakdown
 * charts plot.
 *
 * Grouping is the structure rather than something spliced into a key, so the
 * component is read from the outer key and nothing is ever parsed. The unique
 * `dataKey` Recharts needs per line is generated inside the chart and never
 * leaves it.
 */
export type SeriesByComponent = Record<string, ComponentSeriesMap>;

/** A component whose fan-out request failed, kept so the page can render the
 *  rest and still name what is missing. */
export type FailedComponentMetrics = {
  name: string;
  error: string;
};

export type ProjectResourceMetrics = {
  /** componentName -> that component's resource metrics */
  byComponent: Record<string, ResourceMetrics>;
  failedComponents: FailedComponentMetrics[];
};

export type ProjectHttpMetrics = {
  /** componentName -> that component's HTTP metrics */
  byComponent: Record<string, HttpMetrics>;
  failedComponents: FailedComponentMetrics[];
};

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

// -- Cost Insights types (from the observer FinOps cost/recommendation APIs) --

/**
 * A single cost data point from the observer cost endpoint. When a
 * `granularity` is requested the endpoint returns one item per component per
 * time bucket (so `startTime`/`endTime` describe the bucket); otherwise a
 * single item per component spanning the whole window.
 */
export interface CostItem {
  componentUid?: string;
  component: string;
  startTime: string;
  endTime: string;
  environmentUid?: string;
  environment: string;
  projectUid?: string;
  project: string;
  namespace: string;
  cpuCost: number;
  memoryCost: number;
  /** Resource efficiency ratio in the range 0..1. */
  efficiency: number;
}

/** Current or recommended resource allocation + its cost, from the observer. */
export interface CostResourceProfile {
  cpuRequest?: string;
  cpuLimit?: string;
  memoryRequest?: string;
  memoryLimit?: string;
  cpuCost: number;
  memoryCost: number;
}

/** A right-sizing recommendation for a component in a given environment. */
export interface CostRecommendationItem {
  componentUid?: string;
  component: string;
  environmentUid?: string;
  environment: string;
  projectUid?: string;
  project: string;
  namespace: string;
  current: CostResourceProfile;
  recommendation: CostResourceProfile;
}
