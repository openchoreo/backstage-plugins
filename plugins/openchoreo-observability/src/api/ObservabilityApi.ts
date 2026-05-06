import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';
import {
  Metrics,
  Trace,
  Span,
  SpanDetails,
  RCAReportSummary,
  RCAReportDetailed,
  AlertSummary,
  IncidentSummary,
} from '../types';
import { LogsResponse } from '../components/RuntimeLogs/types';
import { ObserverUrlCache } from './ObserverUrlCache';

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

  getMetrics(
    environmentName: string,
    componentName: string,
    namespaceName: string,
    projectName: string,
    options?: {
      startTime?: string;
      endTime?: string;
      step?: string;
      ciliumEnabled?: boolean;
    },
  ): Promise<Metrics>;

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
}

export const observabilityApiRef = createApiRef<ObservabilityApi>({
  id: 'plugin.openchoreo-observability.service',
});

const DIRECT_HEADER = { 'x-openchoreo-direct': 'true' };

export class ObservabilityClient implements ObservabilityApi {
  private readonly fetchApi: FetchApi;
  private readonly urlCache: ObserverUrlCache;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.fetchApi = options.fetchApi;
    this.urlCache = new ObserverUrlCache(options);
  }

  async getMetrics(
    environmentName: string,
    componentName: string,
    namespaceName: string,
    projectName: string,
    options?: {
      startTime?: string;
      endTime?: string;
      step?: string;
      ciliumEnabled?: boolean;
    },
  ): Promise<Metrics> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    const searchScope = {
      namespace: namespaceName,
      project: projectName,
      component: componentName,
      environment: environmentName,
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

    const ciliumEnabled = options?.ciliumEnabled ?? false;

    const [usageResponse, httpResponse] = await Promise.all([
      this.fetchApi.fetch(`${observerUrl}/api/v1/metrics/query`, {
        ...fetchOptions,
        body: JSON.stringify({ ...baseBody, metric: 'resource' }),
      }),
      ciliumEnabled
        ? this.fetchApi.fetch(`${observerUrl}/api/v1/metrics/query`, {
            ...fetchOptions,
            body: JSON.stringify({ ...baseBody, metric: 'http' }),
          })
        : Promise.resolve(null),
    ]);

    if (!usageResponse.ok) {
      const error = await this.parseError(usageResponse);
      if (error.includes('Observability is not configured for component')) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(
        error || `Failed to fetch metrics: ${usageResponse.statusText}`,
      );
    }

    if (httpResponse !== null && !httpResponse.ok) {
      const error = await this.parseError(httpResponse);
      throw new Error(
        error || `Failed to fetch HTTP metrics: ${httpResponse.statusText}`,
      );
    }

    const usageData = await usageResponse.json();
    const httpData = httpResponse !== null ? await httpResponse.json() : null;

    return {
      cpuUsage: {
        cpuUsage: usageData.cpuUsage ?? [],
        cpuRequests: usageData.cpuRequests ?? [],
        cpuLimits: usageData.cpuLimits ?? [],
      },
      memoryUsage: {
        memoryUsage: usageData.memoryUsage ?? [],
        memoryRequests: usageData.memoryRequests ?? [],
        memoryLimits: usageData.memoryLimits ?? [],
      },
      networkThroughput: {
        requestCount: httpData?.requestCount ?? [],
        successfulRequestCount: httpData?.successfulRequestCount ?? [],
        unsuccessfulRequestCount: httpData?.unsuccessfulRequestCount ?? [],
      },
      networkLatency: {
        meanLatency: httpData?.meanLatency ?? [],
        latencyP50: httpData?.latencyP50 ?? [],
        latencyP90: httpData?.latencyP90 ?? [],
        latencyP99: httpData?.latencyP99 ?? [],
      },
    };
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
