import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';
import { Metrics, Trace, RCAReportSummary, RCAReportDetailed } from '../types';
import { LogsResponse } from '../components/RuntimeLogs/types';

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
    projectId: string,
    environmentId: string,
    environmentName: string,
    namespaceName: string,
    projectName: string,
    componentUids: string[],
    options?: {
      startTime?: string;
      endTime?: string;
      status?: 'pending' | 'completed' | 'failed';
      limit?: number;
    },
  ): Promise<{
    reports: RCAReportSummary[];
    totalCount?: number;
    tookMs?: number;
  }>;

  getRCAReportByAlert(
    alertId: string,
    projectId: string,
    environmentId: string,
    environmentName: string,
    namespaceName: string,
    projectName: string,
    options?: {
      version?: number;
    },
  ): Promise<RCAReportDetailed>;
}

export const observabilityApiRef = createApiRef<ObservabilityApi>({
  id: 'plugin.openchoreo-observability.service',
});

export class ObservabilityClient implements ObservabilityApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
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
    const baseUrl = await this.discoveryApi.getBaseUrl(
      'openchoreo-observability-backend',
    );
    const response = await this.fetchApi.fetch(`${baseUrl}/metrics`, {
      method: 'POST',
      body: JSON.stringify({
        componentId,
        projectId,
        environmentId,
        environmentName,
        componentName,
        namespaceName,
        projectName,
        options,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch (e) {
        throw new Error(
          `Failed to fetch metrics: ${response.status} ${response.statusText}`,
        );
      }
      if (
        error.error?.includes('Observability is not configured for component')
      ) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(
        error.error || `Failed to fetch metrics: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return {
      cpuUsage: {
        cpuUsage: data.cpuUsage,
        cpuRequests: data.cpuRequests,
        cpuLimits: data.cpuLimits,
      },
      memoryUsage: {
        memoryUsage: data.memory,
        memoryRequests: data.memoryRequests,
        memoryLimits: data.memoryLimits,
      },
      networkThroughput: {
        requestCount: data.requestCount,
        successfulRequestCount: data.successfulRequestCount,
        unsuccessfulRequestCount: data.unsuccessfulRequestCount,
      },
      networkLatency: {
        meanLatency: data.meanLatency,
        latencyPercentile50th: data.latencyPercentile50th,
        latencyPercentile90th: data.latencyPercentile90th,
        latencyPercentile99th: data.latencyPercentile99th,
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
    const baseUrl = await this.discoveryApi.getBaseUrl(
      'openchoreo-observability-backend',
    );
    const response = await this.fetchApi.fetch(`${baseUrl}/traces`, {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        environmentId,
        environmentName,
        namespaceName,
        projectName,
        componentUids,
        options,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch (e) {
        throw new Error(
          `Failed to fetch traces: ${response.status} ${response.statusText}`,
        );
      }
      if (
        error.error?.includes('Observability is not configured for component')
      ) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(
        error.error || `Failed to fetch traces: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return {
      traces: data.traces || [],
      tookMs: data.tookMs || 0,
    };
  }

  async getRCAReports(
    projectId: string,
    environmentId: string,
    environmentName: string,
    namespaceName: string,
    projectName: string,
    componentUids: string[],
    options?: {
      startTime?: string;
      endTime?: string;
      status?: 'pending' | 'completed' | 'failed';
      limit?: number;
    },
  ): Promise<{
    reports: RCAReportSummary[];
    totalCount?: number;
    tookMs?: number;
  }> {
    const baseUrl = await this.discoveryApi.getBaseUrl(
      'openchoreo-observability-backend',
    );
    const response = await this.fetchApi.fetch(`${baseUrl}/rca-reports`, {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        environmentId,
        environmentName,
        namespaceName,
        projectName,
        componentUids,
        options,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch (e) {
        throw new Error(
          `Failed to fetch RCA reports: ${response.status} ${response.statusText}`,
        );
      }
      if (error.error?.includes('RCA service is not configured')) {
        throw new Error('RCA service is not configured');
      }
      if (
        error.error?.includes('Observability is not configured for component')
      ) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(
        error.error || `Failed to fetch RCA reports: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return {
      reports: data.reports || [],
      totalCount: data.totalCount,
      tookMs: data.tookMs,
    };
  }

  async getRCAReportByAlert(
    alertId: string,
    projectId: string,
    environmentId: string,
    environmentName: string,
    namespaceName: string,
    projectName: string,
    options?: {
      version?: number;
    },
  ): Promise<RCAReportDetailed> {
    const baseUrl = await this.discoveryApi.getBaseUrl(
      'openchoreo-observability-backend',
    );
    const response = await this.fetchApi.fetch(
      `${baseUrl}/rca-reports/alert/${alertId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          environmentId,
          environmentName,
          namespaceName,
          projectName,
          options,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch (e) {
        throw new Error(
          `Failed to fetch RCA report: ${response.status} ${response.statusText}`,
        );
      }
      if (error.error?.includes('RCA service is not configured')) {
        throw new Error('RCA service is not configured');
      }
      if (error.error?.includes('RCA report not found')) {
        throw new Error('RCA report not found');
      }
      throw new Error(
        error.error || `Failed to fetch RCA report: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data;
  }

  async getRuntimeLogs(
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
    },
  ): Promise<LogsResponse> {
    const baseUrl = await this.discoveryApi.getBaseUrl(
      'openchoreo-observability-backend',
    );
    const url = new URL(`${baseUrl}/logs/component/${componentName}`);
    url.searchParams.set('namespaceName', namespaceName);
    url.searchParams.set('projectName', projectName);

    const response = await this.fetchApi.fetch(url.toString(), {
      method: 'POST',
      body: JSON.stringify({
        componentId,
        projectId,
        environmentId,
        namespaceName,
        projectName,
        environmentName,
        componentName,
        options: {
          limit: options?.limit,
          startTime: options?.startTime,
          endTime: options?.endTime,
          logLevels: options?.logLevels,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch (e) {
        throw new Error(
          `Failed to fetch runtime logs: ${response.status} ${response.statusText}`,
        );
      }
      if (
        error.error?.includes('Observability is not configured for component')
      ) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(
        error.error ||
          `Failed to fetch runtime logs: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data;
  }
}
