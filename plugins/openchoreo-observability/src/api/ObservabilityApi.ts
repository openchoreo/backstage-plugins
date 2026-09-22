import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';
import {
  ResourceMetrics,
  HttpMetrics,
  MetricType,
  Trace,
  Span,
  SpanDetails,
  RCAReportSummary,
  RCAReportDetailed,
  AlertSummary,
  IncidentSummary,
  FinOpsReportSummary,
  FinOpsReportDetailed,
  DoraGranularity,
  DoraMetricName,
  DoraMetricsResponse,
  DoraDeploymentsResponse,
  DoraSearchScope,
  CostItem,
  CostRecommendationItem,
} from '../types';
import { LogsResponse } from '../components/RuntimeLogs/types';
import {
  PlatformLogFilterValuesQueryOptions,
  PlatformLogFilterValuesResponse,
  PlatformLogsQueryOptions,
  PlatformLogsResponse,
} from '../components/PlatformLogs/types';
import { EventsResponse } from '../components/RuntimeEvents/types';
import {
  AuditLogFilterValuesRequest,
  AuditLogFilterValuesResponse,
  AuditLogsQueryRequest,
  AuditLogsResponse,
} from '../components/AuditLogs/types';
import { ObserverUrlCache } from './ObserverUrlCache';
import {
  AuditFilterValuesNotSupportedError,
  AuditLogsForbiddenError,
  AuditLogsNotSupportedError,
} from './AuditLogsErrors';

export interface ObservabilityApi {
  getRuntimeLogs(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName?: string,
    options?: {
      limit?: number;
      startTime?: string;
      endTime?: string;
      logLevels?: string[];
      searchQuery?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<LogsResponse>;

  /**
   * Query platform (system component) logs from a specific observability plane.
   *
   * Takes the observer URL directly rather than resolving it from a
   * namespace+environment pair like every other method here: platform logs are not
   * scoped to an environment, so there is nothing for `ObserverUrlCache` to resolve.
   * The caller picks the plane (its `spec.observerURL` is on the catalog entity).
   */
  getPlatformLogs(
    observerUrl: string,
    options?: PlatformLogsQueryOptions,
  ): Promise<PlatformLogsResponse>;

  /**
   * List the distinct values one platform logs filter can take, so a picker can offer
   * the values reachable in the whole matching set rather than only those that appear
   * in the page of records already loaded.
   *
   * Resolves to `null` when this plane cannot answer - an observer predating the
   * endpoint, or a logs adapter that cannot aggregate. That is a different thing from
   * an empty list, and the caller is expected to fall back rather than show nothing.
   */
  getPlatformLogFilterValues(
    observerUrl: string,
    options: PlatformLogFilterValuesQueryOptions,
  ): Promise<PlatformLogFilterValuesResponse | null>;

  getRuntimeEvents(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName?: string,
    options?: {
      limit?: number;
      startTime?: string;
      endTime?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<EventsResponse>;

  getMetrics(
    environmentName: string,
    componentName: string | undefined,
    namespaceName: string,
    projectName: string,
    options?: {
      startTime?: string;
      endTime?: string;
      step?: string;
      type?: MetricType;
    },
  ): Promise<ResourceMetrics | HttpMetrics>;

  getTraces(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName?: string,
    options?: {
      limit?: number;
      startTime?: string;
      endTime?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<{
    traces: Trace[];
    total: number;
    tookMs: number;
  }>;

  getTraceSpans(
    traceId: string,
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName?: string,
    options?: {
      startTime?: string;
      endTime?: string;
    },
  ): Promise<{
    spans: Span[];
    total: number;
    tookMs: number;
  }>;

  getSpanDetails(
    traceId: string,
    spanId: string,
    namespaceName: string,
    environmentName: string,
  ): Promise<SpanDetails>;

  getRCAReports(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    options?: {
      startTime?: string;
      endTime?: string;
      status?: 'pending' | 'completed' | 'failed';
      limit?: number;
    },
  ): Promise<{
    reports: RCAReportSummary[];
    totalCount?: number;
  }>;

  getRCAReport(
    reportId: string,
    environmentName: string,
    namespaceName: string,
  ): Promise<RCAReportDetailed>;

  getIncidents(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName?: string,
    options?: {
      startTime?: string;
      endTime?: string;
      limit?: number;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<{
    incidents: IncidentSummary[];
    total: number;
  }>;

  getAlerts(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName: string,
    options?: {
      startTime?: string;
      endTime?: string;
      limit?: number;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<{
    alerts: AlertSummary[];
    total: number;
  }>;

  updateIncidentStatus(
    incidentId: string,
    status: 'acknowledged' | 'resolved',
    namespaceName: string,
    environmentName: string,
  ): Promise<void>;

  getFinOpsReports(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    options?: {
      startTime?: string;
      endTime?: string;
      status?: 'pending' | 'completed' | 'failed';
      limit?: number;
      sort?: string;
    },
  ): Promise<{
    reports: FinOpsReportSummary[];
    totalCount?: number;
  }>;

  getFinOpsReport(
    reportId: string,
    environmentName: string,
    namespaceName: string,
  ): Promise<FinOpsReportDetailed>;

  getDoraMetrics(
    scope: DoraSearchScope,
    options: {
      startTime: string;
      endTime: string;
      granularity?: DoraGranularity;
      metrics?: DoraMetricName[];
    },
  ): Promise<DoraMetricsResponse>;

  getDoraDeployments(
    scope: DoraSearchScope,
    options: {
      startTime: string;
      endTime: string;
      limit?: number;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<DoraDeploymentsResponse>;

  getCosts(
    namespaceName: string,
    environmentName: string,
    options?: {
      project?: string;
      component?: string;
      startTime?: string;
      endTime?: string;
      granularity?: string;
    },
  ): Promise<{ items: CostItem[] }>;

  getCostRecommendations(
    namespaceName: string,
    environmentName: string,
    options?: {
      project?: string;
      component?: string;
      startTime?: string;
      endTime?: string;
    },
  ): Promise<{ items: CostRecommendationItem[] }>;

  /**
   * Queries the audit trail. Cluster-scoped: the observer evaluates
   * `auditlogs:view` before reading any of the tenancy filters in the body.
   */
  queryAuditLogs(request: AuditLogsQueryRequest): Promise<AuditLogsResponse>;

  /**
   * Lists the distinct values one audit filter takes under a query — what a
   * filter picker is populated from. One filter per request, by design.
   */
  queryAuditLogFilterValues(
    request: AuditLogFilterValuesRequest,
  ): Promise<AuditLogFilterValuesResponse>;
}

export const observabilityApiRef = createApiRef<ObservabilityApi>({
  id: 'plugin.openchoreo-observability.service',
});

const DIRECT_HEADER = { 'x-openchoreo-direct': 'true' };

/**
 * Writes the filters shared by the platform logs record query and its filter values
 * query onto a URL.
 *
 * Shared rather than duplicated because the contract is that the two take the same
 * parameters: a filter values answer only describes the records the log query would
 * return if both spell the query the same way.
 *
 * Multi-value filters are comma-separated, matching the endpoints'
 * `style: form, explode: false`. An empty list is not a filter, so it is omitted
 * entirely rather than sent as an empty value. The label selector goes over the wire as
 * `kubectl -l` spells it; plane attribution is expressed there rather than as its own
 * parameter.
 */
function setPlatformLogsRecordParams(
  url: URL,
  options: Omit<PlatformLogsQueryOptions, 'limit' | 'sortOrder'>,
): void {
  const listParams: Array<[string, string[] | undefined]> = [
    ['clusterInstance', options.clusterInstances],
    ['namespace', options.namespaces],
    ['podName', options.podNames],
    ['containerName', options.containerNames],
    ['logLevels', options.logLevels],
  ];
  for (const [name, values] of listParams) {
    if (values?.length) {
      url.searchParams.set(name, values.join(','));
    }
  }

  if (options.labels) {
    url.searchParams.set('labels', options.labels);
  }
  if (options.searchQuery) {
    url.searchParams.set('searchPhrase', options.searchQuery);
  }
}

export class ObservabilityClient implements ObservabilityApi {
  private readonly fetchApi: FetchApi;
  private readonly urlCache: ObserverUrlCache;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.fetchApi = options.fetchApi;
    this.urlCache = new ObserverUrlCache(options);
  }

  async getMetrics(
    environmentName: string,
    componentName: string | undefined,
    namespaceName: string,
    projectName: string,
    options?: {
      startTime?: string;
      endTime?: string;
      step?: string;
      type?: MetricType;
    },
  ): Promise<ResourceMetrics | HttpMetrics> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    const searchScope = {
      namespace: namespaceName,
      project: projectName,
      environment: environmentName,
      ...(componentName ? { component: componentName } : {}),
    };

    const baseBody = {
      startTime:
        options?.startTime ?? new Date(Date.now() - 3600000).toISOString(),
      endTime: options?.endTime ?? new Date().toISOString(),
      searchScope,
      ...(options?.step ? { step: options.step } : {}),
    };

    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
    };

    const metricType = options?.type ?? 'resource';

    const response = await this.fetchApi.fetch(
      `${observerUrl}/api/v1/metrics/query`,
      {
        ...fetchOptions,
        body: JSON.stringify({ ...baseBody, metric: metricType }),
      },
    );

    if (!response.ok) {
      const error = await this.parseError(response);
      if (error.includes('Observability is not configured for component')) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(
        error || `Failed to fetch metrics: ${response.statusText}`,
      );
    }

    const data = await response.json();

    switch (metricType) {
      case 'resource':
        return {
          cpuUsage: {
            cpuUsage: data.cpuUsage ?? [],
            cpuRequests: data.cpuRequests ?? [],
            cpuLimits: data.cpuLimits ?? [],
          },
          memoryUsage: {
            memoryUsage: data.memoryUsage ?? [],
            memoryRequests: data.memoryRequests ?? [],
            memoryLimits: data.memoryLimits ?? [],
          },
        };
      case 'http':
        return {
          networkThroughput: {
            requestCount: data.requestCount ?? [],
            successfulRequestCount: data.successfulRequestCount ?? [],
            unsuccessfulRequestCount: data.unsuccessfulRequestCount ?? [],
          },
          networkLatency: {
            meanLatency: data.meanLatency ?? [],
            latencyP50: data.latencyP50 ?? [],
            latencyP90: data.latencyP90 ?? [],
            latencyP99: data.latencyP99 ?? [],
          },
        };
      default:
        throw new Error(`Unsupported metric type: ${metricType}`);
    }
  }

  async getTraces(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName?: string,
    options?: {
      limit?: number;
      startTime?: string;
      endTime?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<{
    traces: Trace[];
    total: number;
    tookMs: number;
  }> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    const response = await this.fetchApi.fetch(
      `${observerUrl}/api/v1alpha1/traces/query`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
        body: JSON.stringify({
          startTime:
            options?.startTime ?? new Date(Date.now() - 3600000).toISOString(),
          endTime: options?.endTime ?? new Date().toISOString(),
          limit: options?.limit ?? 100,
          sortOrder: options?.sortOrder ?? 'desc',
          searchScope: {
            namespace: namespaceName,
            project: projectName,
            ...(componentName ? { component: componentName } : {}),
            environment: environmentName,
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await this.parseError(response);
      if (error.includes('Observability is not configured for component')) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(
        error || `Failed to fetch traces: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return {
      traces: (data.traces ?? []).map((t: any) => ({
        traceId: t.traceId ?? '',
        traceName: t.traceName,
        spanCount: t.spanCount ?? 0,
        rootSpanId: t.rootSpanId,
        rootSpanName: t.rootSpanName,
        rootSpanKind: t.rootSpanKind,
        startTime: t.startTime ?? '',
        endTime: t.endTime ?? '',
        durationNs: t.durationNs ?? 0,
        hasErrors: t.hasErrors ?? false,
      })),
      total: data.total ?? 0,
      tookMs: data.tookMs ?? 0,
    };
  }

  async getTraceSpans(
    traceId: string,
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName?: string,
    options?: {
      startTime?: string;
      endTime?: string;
    },
  ): Promise<{
    spans: Span[];
    total: number;
    tookMs: number;
  }> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    const response = await this.fetchApi.fetch(
      `${observerUrl}/api/v1alpha1/traces/${encodeURIComponent(
        traceId,
      )}/spans/query`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
        body: JSON.stringify({
          startTime:
            options?.startTime ?? new Date(Date.now() - 3600000).toISOString(),
          endTime: options?.endTime ?? new Date().toISOString(),
          limit: 1000,
          sortOrder: 'asc',
          searchScope: {
            namespace: namespaceName,
            project: projectName,
            ...(componentName ? { component: componentName } : {}),
            environment: environmentName,
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(
        error ||
          `Failed to fetch spans for trace ${traceId}: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return {
      spans: (data.spans ?? []).map((s: any) => ({
        spanId: s.spanId ?? '',
        spanName: s.spanName ?? '',
        spanKind: s.spanKind,
        startTime: s.startTime ?? '',
        endTime: s.endTime ?? '',
        durationNs: s.durationNs ?? 0,
        parentSpanId: s.parentSpanId,
        status: s.status,
      })),
      total: data.total ?? 0,
      tookMs: data.tookMs ?? 0,
    };
  }

  async getSpanDetails(
    traceId: string,
    spanId: string,
    namespaceName: string,
    environmentName: string,
  ): Promise<SpanDetails> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    const response = await this.fetchApi.fetch(
      `${observerUrl}/api/v1alpha1/traces/${encodeURIComponent(
        traceId,
      )}/spans/${encodeURIComponent(spanId)}`,
      {
        headers: { ...DIRECT_HEADER },
      },
    );

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(
        error ||
          `Failed to fetch span details for span ${spanId}: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return {
      spanId: data.spanId ?? '',
      spanName: data.spanName ?? '',
      spanKind: data.spanKind,
      startTime: data.startTime ?? '',
      endTime: data.endTime ?? '',
      durationNs: data.durationNs ?? 0,
      parentSpanId: data.parentSpanId,
      status: data.status,
      attributes: data.attributes,
      resourceAttributes: data.resourceAttributes,
    };
  }

  async getRCAReports(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    options?: {
      startTime?: string;
      endTime?: string;
      status?: 'pending' | 'completed' | 'failed';
      limit?: number;
    },
  ): Promise<{
    reports: RCAReportSummary[];
    totalCount?: number;
  }> {
    const { rcaAgentUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    if (!rcaAgentUrl) {
      throw new Error('RCA service is not configured');
    }

    const url = new URL(`${rcaAgentUrl}/api/v1/rca-agent/reports`);
    url.searchParams.set('namespace', namespaceName);
    url.searchParams.set('project', projectName);
    url.searchParams.set('environment', environmentName);
    if (options?.startTime)
      url.searchParams.set('startTime', options.startTime);
    if (options?.endTime) url.searchParams.set('endTime', options.endTime);
    if (options?.status) url.searchParams.set('status', options.status);
    if (options?.limit !== undefined)
      url.searchParams.set('limit', String(options.limit));

    let response: Response;
    try {
      response = await this.fetchApi.fetch(url.toString(), {
        headers: { ...DIRECT_HEADER },
      });
    } catch (err) {
      throw new Error(
        `RCA service is unreachable: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    if (!response.ok) {
      const error = await this.parseError(response);
      if (error.includes('RCA service is not configured')) {
        throw new Error('RCA service is not configured');
      }
      if (error.includes('Observability is not configured for component')) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(
        error || `Failed to fetch RCA reports: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return {
      reports: data.reports || [],
      totalCount: data.totalCount,
    };
  }

  async getRCAReport(
    reportId: string,
    environmentName: string,
    namespaceName: string,
  ): Promise<RCAReportDetailed> {
    const { rcaAgentUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    if (!rcaAgentUrl) {
      throw new Error('RCA service is not configured');
    }

    const url = new URL(
      `${rcaAgentUrl}/api/v1/rca-agent/reports/${encodeURIComponent(reportId)}`,
    );

    let response: Response;
    try {
      response = await this.fetchApi.fetch(url.toString(), {
        headers: { ...DIRECT_HEADER },
      });
    } catch (err) {
      throw new Error(
        `RCA service is unreachable: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    if (!response.ok) {
      const error = await this.parseError(response);
      if (error.includes('RCA service is not configured')) {
        throw new Error('RCA service is not configured');
      }
      if (error.includes('RCA report not found')) {
        throw new Error('RCA report not found');
      }
      throw new Error(
        error || `Failed to fetch RCA report: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data;
  }

  async getIncidents(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName?: string,
    options?: {
      startTime?: string;
      endTime?: string;
      limit?: number;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<{
    incidents: IncidentSummary[];
    total: number;
  }> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    const response = await this.fetchApi.fetch(
      `${observerUrl}/api/v1alpha1/incidents/query`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
        body: JSON.stringify({
          startTime:
            options?.startTime ?? new Date(Date.now() - 3600000).toISOString(),
          endTime: options?.endTime ?? new Date().toISOString(),
          limit: options?.limit ?? 100,
          sortOrder: options?.sortOrder ?? 'desc',
          searchScope: {
            namespace: namespaceName,
            project: projectName,
            ...(componentName ? { component: componentName } : {}),
            environment: environmentName,
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await this.parseError(response);
      if (error.includes('Observability is not configured for component')) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(
        error || `Failed to fetch incidents: ${response.statusText}`,
      );
    }

    const data = await response.json();
    const validStatuses = ['active', 'acknowledged', 'resolved'];
    return {
      incidents: (data.incidents ?? [])
        .filter((i: any) => validStatuses.includes(i.status))
        .map(
          (i: any): IncidentSummary => ({
            incidentId: i.incidentId ?? '',
            alertId: i.alertId ?? '',
            status: i.status,
            description: i.description,
            notes: i.notes,
            timestamp: i.timestamp,
            triggeredAt: i.triggeredAt,
            acknowledgedAt: i.acknowledgedAt,
            resolvedAt: i.resolvedAt,
            incidentTriggerAiRca: i.incidentTriggerAiRca ?? false,
            incidentTriggerAiCostAnalysis:
              i.incidentTriggerAiCostAnalysis ?? false,
            projectName: i.labels?.projectName,
            componentName: i.labels?.componentName,
            environmentName: i.labels?.environmentName,
            namespaceName: i.labels?.namespaceName,
          }),
        ),
      total: data.total ?? 0,
    };
  }

  async getAlerts(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName: string,
    options?: {
      startTime?: string;
      endTime?: string;
      limit?: number;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<{
    alerts: AlertSummary[];
    total: number;
  }> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    const response = await this.fetchApi.fetch(
      `${observerUrl}/api/v1alpha1/alerts/query`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
        body: JSON.stringify({
          startTime:
            options?.startTime ?? new Date(Date.now() - 3600000).toISOString(),
          endTime: options?.endTime ?? new Date().toISOString(),
          limit: options?.limit ?? 100,
          sortOrder: options?.sortOrder ?? 'desc',
          searchScope: {
            namespace: namespaceName,
            project: projectName,
            component: componentName,
            environment: environmentName,
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await this.parseError(response);
      if (error.includes('Observability is not configured for component')) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(
        error || `Failed to fetch alerts: ${response.statusText}`,
      );
    }

    const data = await response.json();

    return {
      alerts: (data.alerts ?? []).map(
        (a: any): AlertSummary => ({
          timestamp: a.timestamp,
          alertId: a.alertId ?? '',
          alertValue: a.alertValue,
          ruleName: a.metadata?.alertRule?.name,
          ruleDescription: a.metadata?.alertRule?.description,
          severity: a.metadata?.alertRule?.severity,
          sourceType: a.metadata?.alertRule?.source?.type,
          sourceQuery: a.metadata?.alertRule?.source?.query,
          sourceMetric: a.metadata?.alertRule?.source?.metric,
          projectName: a.metadata?.labels?.projectName,
          componentName: a.metadata?.labels?.componentName,
          environmentName: a.metadata?.labels?.environmentName,
          namespaceName: a.metadata?.labels?.namespaceName,
          notificationChannels: a.notificationChannels ?? [],
          incidentEnabled: a.incidentEnabled ?? false,
        }),
      ),
      total: data.total ?? 0,
    };
  }

  async getRuntimeLogs(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName?: string,
    options?: {
      limit?: number;
      startTime?: string;
      endTime?: string;
      logLevels?: string[];
      searchQuery?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<LogsResponse> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    const response = await this.fetchApi.fetch(
      `${observerUrl}/api/v1/logs/query`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
        body: JSON.stringify({
          startTime:
            options?.startTime ||
            new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          endTime: options?.endTime || new Date().toISOString(),
          limit: options?.limit || 100,
          sortOrder: options?.sortOrder || 'desc',
          ...(options?.logLevels &&
            options.logLevels.length > 0 && { logLevels: options.logLevels }),
          ...(options?.searchQuery && {
            searchPhrase: options.searchQuery,
          }),
          searchScope: {
            namespace: namespaceName,
            project: projectName,
            ...(componentName ? { component: componentName } : {}),
            environment: environmentName,
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await this.parseError(response);
      if (error.includes('Observability is not configured for component')) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(
        error ||
          `Failed to fetch runtime logs: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data;
  }

  async getPlatformLogs(
    observerUrl: string,
    options?: PlatformLogsQueryOptions,
  ): Promise<PlatformLogsResponse> {
    const url = new URL(`${observerUrl}/api/v1alpha1/platform-logs`);

    url.searchParams.set(
      'startTime',
      options?.startTime ?? new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    );
    url.searchParams.set(
      'endTime',
      options?.endTime ?? new Date().toISOString(),
    );
    url.searchParams.set('limit', String(options?.limit ?? 100));
    url.searchParams.set('sortOrder', options?.sortOrder ?? 'desc');

    setPlatformLogsRecordParams(url, options ?? {});

    const response = await this.fetchApi.fetch(url.toString(), {
      headers: { ...DIRECT_HEADER },
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      if (response.status === 403) {
        throw new Error(
          'You do not have permission to view platform logs. This requires a cluster-scoped role.',
        );
      }
      if (response.status === 501) {
        throw new Error(
          'The logs module behind this observability plane does not support platform logs yet.',
        );
      }
      throw new Error(
        error ||
          `Failed to fetch platform logs: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  }

  async getPlatformLogFilterValues(
    observerUrl: string,
    options: PlatformLogFilterValuesQueryOptions,
  ): Promise<PlatformLogFilterValuesResponse | null> {
    const url = new URL(
      `${observerUrl}/api/v1alpha1/platform-logs/filter-values`,
    );

    url.searchParams.set('filter', options.filter);
    url.searchParams.set(
      'startTime',
      options.startTime ?? new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    );
    url.searchParams.set(
      'endTime',
      options.endTime ?? new Date().toISOString(),
    );

    // The record query goes over the wire whole, the named filter's own selections
    // included: the observer ignores those, and sending a query with them stripped
    // would leave it unable to tell "not selected" from "excluded for this call".
    setPlatformLogsRecordParams(url, options);

    if (options.valueSearch) {
      url.searchParams.set('valueSearch', options.valueSearch);
    }
    if (options.maxValues) {
      url.searchParams.set('maxValues', String(options.maxValues));
    }

    const response = await this.fetchApi.fetch(url.toString(), {
      headers: { ...DIRECT_HEADER },
    });

    if (!response.ok) {
      // Answered rather than thrown: an observer that predates the endpoint (404) and
      // a logs adapter that cannot aggregate (501) are both "this plane cannot answer",
      // which the caller handles by falling back to the values it derived itself.
      // Throwing would also earn a retry, and neither status improves on a second ask.
      //
      // Deliberately unlike getPlatformLogs, which throws on 501: there, no logs at all
      // is the whole answer and has to be said out loud. Here the page still works.
      if (response.status === 404 || response.status === 501) {
        return null;
      }
      const error = await this.parseError(response);
      if (response.status === 403) {
        throw new Error(
          'You do not have permission to view platform logs. This requires a cluster-scoped role.',
        );
      }
      throw new Error(
        error ||
          `Failed to fetch platform log filter values: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  }

  async getRuntimeEvents(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName?: string,
    options?: {
      limit?: number;
      startTime?: string;
      endTime?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<EventsResponse> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    const response = await this.fetchApi.fetch(
      `${observerUrl}/api/v1/events/query`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
        body: JSON.stringify({
          startTime:
            options?.startTime ||
            new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          endTime: options?.endTime || new Date().toISOString(),
          limit: options?.limit || 100,
          sortOrder: options?.sortOrder || 'desc',
          searchScope: {
            namespace: namespaceName,
            project: projectName,
            ...(componentName ? { component: componentName } : {}),
            environment: environmentName,
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await this.parseError(response);
      if (error.includes('Observability is not configured for component')) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(
        error ||
          `Failed to fetch events: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data;
  }

  async updateIncidentStatus(
    incidentId: string,
    status: 'acknowledged' | 'resolved',
    namespaceName: string,
    environmentName: string,
  ): Promise<void> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    const response = await this.fetchApi.fetch(
      `${observerUrl}/api/v1alpha1/incidents/${encodeURIComponent(incidentId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
        body: JSON.stringify({ status }),
      },
    );

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(
        error || `Failed to update incident: ${response.statusText}`,
      );
    }
  }

  async getFinOpsReports(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    options?: {
      startTime?: string;
      endTime?: string;
      status?: 'pending' | 'completed' | 'failed';
      limit?: number;
      sort?: string;
    },
  ): Promise<{
    reports: FinOpsReportSummary[];
    totalCount?: number;
  }> {
    const { finopsAgentUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    if (!finopsAgentUrl) {
      throw new Error('FinOps service is not configured');
    }

    const url = new URL(`${finopsAgentUrl}/api/v1alpha1/reports`);
    url.searchParams.set('namespace', namespaceName);
    url.searchParams.set('project', projectName);
    url.searchParams.set('environment', environmentName);
    if (options?.startTime)
      url.searchParams.set('startTime', options.startTime);
    if (options?.endTime) url.searchParams.set('endTime', options.endTime);
    if (options?.status) url.searchParams.set('status', options.status);
    if (options?.limit !== undefined)
      url.searchParams.set('limit', String(options.limit));
    if (options?.sort) url.searchParams.set('sort', options.sort);

    let response: Response;
    try {
      response = await this.fetchApi.fetch(url.toString(), {
        headers: { ...DIRECT_HEADER },
      });
    } catch (err) {
      throw new Error(
        `FinOps service is unreachable: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    if (!response.ok) {
      const error = await this.parseError(response);
      if (error.includes('FinOps service is not configured')) {
        throw new Error('FinOps service is not configured');
      }
      if (error.includes('Observability is not configured for component')) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(
        error || `Failed to fetch FinOps reports: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return {
      reports: data.reports || [],
      totalCount: data.totalCount,
    };
  }

  async getFinOpsReport(
    reportId: string,
    environmentName: string,
    namespaceName: string,
  ): Promise<FinOpsReportDetailed> {
    const { finopsAgentUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    if (!finopsAgentUrl) {
      throw new Error('FinOps service is not configured');
    }

    const url = new URL(
      `${finopsAgentUrl}/api/v1alpha1/reports/${encodeURIComponent(reportId)}`,
    );

    let response: Response;
    try {
      response = await this.fetchApi.fetch(url.toString(), {
        headers: { ...DIRECT_HEADER },
      });
    } catch (err) {
      throw new Error(
        `FinOps service is unreachable: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    if (!response.ok) {
      const error = await this.parseError(response);
      if (error.includes('FinOps service is not configured')) {
        throw new Error('FinOps service is not configured');
      }
      if (error.includes('FinOps report not found')) {
        throw new Error('FinOps report not found');
      }
      throw new Error(
        error || `Failed to fetch FinOps report: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data;
  }

  async getDoraMetrics(
    scope: DoraSearchScope,
    options: {
      startTime: string;
      endTime: string;
      granularity?: DoraGranularity;
      metrics?: DoraMetricName[];
    },
  ): Promise<DoraMetricsResponse> {
    // Environment-specific slices resolve through that environment; wider scopes
    // resolve at namespace level (empty environment).
    const { observerUrl } = await this.urlCache.resolveUrls(
      scope.namespace,
      scope.environment ?? '',
    );

    const response = await this.fetchApi.fetch(
      `${observerUrl}/api/v1alpha1/delivery-insights/dora/query`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
        body: JSON.stringify({
          searchScope: scope,
          startTime: options.startTime,
          endTime: options.endTime,
          granularity: options.granularity ?? 'daily',
          ...(options.metrics?.length ? { metrics: options.metrics } : {}),
        }),
      },
    );

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(
        error || `Failed to fetch DORA metrics: ${response.statusText}`,
      );
    }

    return response.json();
  }

  async getDoraDeployments(
    scope: DoraSearchScope,
    options: {
      startTime: string;
      endTime: string;
      limit?: number;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<DoraDeploymentsResponse> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      scope.namespace,
      scope.environment ?? '',
    );

    const response = await this.fetchApi.fetch(
      `${observerUrl}/api/v1alpha1/delivery-insights/dora/deployments/query`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
        body: JSON.stringify({
          searchScope: scope,
          startTime: options.startTime,
          endTime: options.endTime,
          limit: options.limit ?? 100,
          sortOrder: options.sortOrder ?? 'desc',
        }),
      },
    );

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new Error(
        error || `Failed to fetch deployments: ${response.statusText}`,
      );
    }

    return response.json();
  }

  async getCosts(
    namespaceName: string,
    environmentName: string,
    options?: {
      project?: string;
      component?: string;
      startTime?: string;
      endTime?: string;
      granularity?: string;
    },
  ): Promise<{ items: CostItem[] }> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    const url = new URL(
      `${observerUrl}/api/v1alpha1/costs/namespaces/${encodeURIComponent(
        namespaceName,
      )}/environments/${encodeURIComponent(environmentName)}`,
    );
    if (options?.project) url.searchParams.set('project', options.project);
    if (options?.component)
      url.searchParams.set('component', options.component);
    if (options?.startTime)
      url.searchParams.set('startTime', options.startTime);
    if (options?.endTime) url.searchParams.set('endTime', options.endTime);
    if (options?.granularity)
      url.searchParams.set('granularity', options.granularity);

    const response = await this.fetchApi.fetch(url.toString(), {
      headers: { ...DIRECT_HEADER },
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      if (error.includes('Observability is not configured for component')) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(error || `Failed to fetch costs: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      items: (data.items ?? []).map((item: any) => ({
        ...item,
        cpuCost: item.cpuCost ?? 0,
        memoryCost: item.memoryCost ?? 0,
        efficiency: item.efficiency ?? 0,
      })),
    };
  }

  async getCostRecommendations(
    namespaceName: string,
    environmentName: string,
    options?: {
      project?: string;
      component?: string;
      startTime?: string;
      endTime?: string;
    },
  ): Promise<{ items: CostRecommendationItem[] }> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    const url = new URL(
      `${observerUrl}/api/v1alpha1/costs/namespaces/${encodeURIComponent(
        namespaceName,
      )}/environments/${encodeURIComponent(environmentName)}/recommendations`,
    );
    if (options?.project) url.searchParams.set('project', options.project);
    if (options?.component)
      url.searchParams.set('component', options.component);
    if (options?.startTime)
      url.searchParams.set('startTime', options.startTime);
    if (options?.endTime) url.searchParams.set('endTime', options.endTime);

    const response = await this.fetchApi.fetch(url.toString(), {
      headers: { ...DIRECT_HEADER },
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      if (error.includes('Observability is not configured for component')) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(
        error || `Failed to fetch cost recommendations: ${response.statusText}`,
      );
    }

    const data = await response.json();
    const normalizeProfile = (p: any) => ({
      ...p,
      cpuCost: p?.cpuCost ?? 0,
      memoryCost: p?.memoryCost ?? 0,
    });
    return {
      items: (data.items ?? []).map((item: any) => ({
        ...item,
        current: normalizeProfile(item.current),
        recommendation: normalizeProfile(item.recommendation),
      })),
    };
  }

  async queryAuditLogs(
    request: AuditLogsQueryRequest,
  ): Promise<AuditLogsResponse> {
    const { observerUrl } = await this.urlCache.resolvePlatformUrls();

    const response = await this.fetchApi.fetch(
      `${observerUrl}/api/v1alpha1/audit-logs/query`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      throw await this.parseAuditError(
        response,
        'Failed to query the audit trail',
      );
    }

    return response.json();
  }

  async queryAuditLogFilterValues(
    request: AuditLogFilterValuesRequest,
  ): Promise<AuditLogFilterValuesResponse> {
    const { observerUrl } = await this.urlCache.resolvePlatformUrls();

    const response = await this.fetchApi.fetch(
      `${observerUrl}/api/v1alpha1/audit-logs/filter-values`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      const error = await this.parseAuditError(
        response,
        'Failed to list audit log filter values',
      );
      // An adapter can serve the records and aggregate nothing, so this 501
      // means "no pick list for this filter" rather than "no audit trail".
      if (error instanceof AuditLogsNotSupportedError) {
        throw new AuditFilterValuesNotSupportedError(error.message);
      }
      throw error;
    }

    return response.json();
  }

  /**
   * Turns an audit error response into the specific error the UI can act on.
   * `parseError` flattens to a string, which loses the status separating "there
   * is no trail here" from "you may not read it".
   */
  private async parseAuditError(
    response: Response,
    fallback: string,
  ): Promise<Error> {
    let body: { errorCode?: string; message?: string; error?: string } = {};
    try {
      const parsed = await response.json();
      // A body of JSON `null` parses without throwing, and reading through it
      // would lose the status the caller acts on.
      if (parsed && typeof parsed === 'object') body = parsed;
    } catch {
      // A non-JSON body (a gateway error page) leaves the status to speak.
    }
    const message =
      body.message ||
      body.error ||
      `${fallback}: ${response.status} ${response.statusText}`;

    if (response.status === 501) {
      return new AuditLogsNotSupportedError(message);
    }
    if (response.status === 403) {
      return new AuditLogsForbiddenError(message);
    }
    return new Error(message);
  }

  private async parseError(response: Response): Promise<string> {
    try {
      const error = await response.json();
      return (
        error.error ||
        error.message ||
        `${response.status} ${response.statusText}`
      );
    } catch {
      return `${response.status} ${response.statusText}`;
    }
  }
}
