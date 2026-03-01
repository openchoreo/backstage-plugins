import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';
import { Metrics, Trace, RCAReportSummary, RCAReportDetailed } from '../types';
import { LogsResponse } from '../components/RuntimeLogs/types';
import { ObserverUrlCache } from './ObserverUrlCache';

export interface ObservabilityApi {
  getRuntimeLogs(
    componentId: string,
    projectId: string,
    environmentId: string,
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName: string,
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
    componentId: string,
    projectId: string,
    environmentId: string,
    environmentName: string,
    componentName: string,
    namespaceName: string,
    projectName: string,
    options?: {
      limit?: number;
      offset?: number;
      startTime?: string;
      endTime?: string;
    },
  ): Promise<Metrics>;

  getTraces(
    projectId: string,
    environmentId: string,
    environmentName: string,
    namespaceName: string,
    projectName: string,
    componentUids: string[],
    options?: {
      limit?: number;
      startTime?: string;
      endTime?: string;
      traceId?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<{
    traces: Trace[];
    tookMs: number;
  }>;

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
    componentId: string,
    projectId: string,
    environmentId: string,
    environmentName: string,
    componentName: string,
    namespaceName: string,
    projectName: string,
    options?: {
      limit?: number;
      offset?: number;
      startTime?: string;
      endTime?: string;
    },
  ): Promise<Metrics> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    const body = JSON.stringify({
      componentId,
      environmentId,
      projectId,
      componentName,
      projectName,
      namespaceName,
      environmentName,
      limit: options?.limit || 100,
      offset: options?.offset || 0,
      startTime: options?.startTime,
      endTime: options?.endTime,
    });

    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
      body,
    };

    const [usageResponse, httpResponse] = await Promise.all([
      this.fetchApi.fetch(
        `${observerUrl}/api/metrics/component/usage`,
        fetchOptions,
      ),
      this.fetchApi.fetch(
        `${observerUrl}/api/metrics/component/http`,
        fetchOptions,
      ),
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

    if (!httpResponse.ok) {
      const error = await this.parseError(httpResponse);
      throw new Error(
        error || `Failed to fetch HTTP metrics: ${httpResponse.statusText}`,
      );
    }

    const [usageData, httpData] = await Promise.all([
      usageResponse.json(),
      httpResponse.json(),
    ]);

    return {
      cpuUsage: {
        cpuUsage: usageData.cpuUsage ?? [],
        cpuRequests: usageData.cpuRequests ?? [],
        cpuLimits: usageData.cpuLimits ?? [],
      },
      memoryUsage: {
        memoryUsage: usageData.memory ?? [],
        memoryRequests: usageData.memoryRequests ?? [],
        memoryLimits: usageData.memoryLimits ?? [],
      },
      networkThroughput: {
        requestCount: httpData.requestCount ?? [],
        successfulRequestCount: httpData.successfulRequestCount ?? [],
        unsuccessfulRequestCount: httpData.unsuccessfulRequestCount ?? [],
      },
      networkLatency: {
        meanLatency: httpData.meanLatency ?? [],
        latencyPercentile50th: httpData.latencyPercentile50th ?? [],
        latencyPercentile90th: httpData.latencyPercentile90th ?? [],
        latencyPercentile99th: httpData.latencyPercentile99th ?? [],
      },
    };
  }

  async getTraces(
    projectId: string,
    environmentId: string,
    environmentName: string,
    namespaceName: string,
    projectName: string,
    componentUids: string[],
    options?: {
      limit?: number;
      startTime?: string;
      endTime?: string;
      traceId?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<{
    traces: Trace[];
    tookMs: number;
  }> {
    const { observerUrl } = await this.urlCache.resolveUrls(
      namespaceName,
      environmentName,
    );

    const response = await this.fetchApi.fetch(`${observerUrl}/api/traces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
      body: JSON.stringify({
        projectUid: projectId,
        componentUids: componentUids.length > 0 ? componentUids : undefined,
        environmentUid: environmentId,
        traceId: options?.traceId,
        startTime: options?.startTime,
        endTime: options?.endTime,
        limit: options?.limit || 100,
        sortOrder: options?.sortOrder || 'desc',
        projectName,
        namespaceName,
        environmentName,
      }),
    });

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
      traces: data.traces || [],
      tookMs: data.tookMs || 0,
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

    const response = await this.fetchApi.fetch(url.toString(), {
      headers: { ...DIRECT_HEADER },
    });

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

    const response = await this.fetchApi.fetch(url.toString(), {
      headers: { ...DIRECT_HEADER },
    });

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

  async getRuntimeLogs(
    componentId: string,
    _projectId: string,
    environmentId: string,
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName: string,
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
      `${observerUrl}/api/logs/component/${encodeURIComponent(componentId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...DIRECT_HEADER },
        body: JSON.stringify({
          startTime:
            options?.startTime ||
            new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          endTime: options?.endTime || new Date().toISOString(),
          environmentId,
          componentName,
          projectName,
          namespaceName,
          environmentName,
          limit: options?.limit || 100,
          sortOrder: options?.sortOrder || 'desc',
          ...(options?.logLevels &&
            options.logLevels.length > 0 && { logLevels: options.logLevels }),
          ...(options?.searchQuery && {
            searchPhrase: options.searchQuery,
          }),
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
