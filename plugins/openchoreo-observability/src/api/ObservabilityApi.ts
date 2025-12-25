import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';
import { Metrics, Trace, RCAReportSummary, RCAReportDetailed } from '../types';

export interface ObservabilityApi {
  getMetrics(
    componentId: string,
    projectId: string,
    environmentId: string,
    environmentName: string,
    componentName: string,
    orgName: string,
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
    orgName: string,
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
    orgName: string,
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
    orgName: string,
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
    orgName: string,
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
        orgName,
        projectName,
        options,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      if (
        error.error.includes('Observability is not configured for component')
      ) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(`Failed to fetch metrics: ${response.statusText}`);
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
    orgName: string,
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
        orgName,
        projectName,
        componentUids,
        options,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      if (
        error.error?.includes('Observability is not configured for component')
      ) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(`Failed to fetch traces: ${response.statusText}`);
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
    orgName: string,
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
        orgName,
        projectName,
        componentUids,
        options,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.error?.includes('RCA service is not enabled')) {
        throw new Error('RCA service is not enabled');
      }
      if (
        error.error?.includes('Observability is not configured for component')
      ) {
        throw new Error('Observability is not enabled for this component');
      }
      throw new Error(`Failed to fetch RCA reports: ${response.statusText}`);
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
    orgName: string,
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
          orgName,
          projectName,
          options,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const error = await response.json();
      if (error.error?.includes('RCA service not available')) {
        throw new Error('RCA service not available');
      }
      if (error.error?.includes('RCA report not found')) {
        throw new Error('RCA report not found');
      }
      throw new Error(`Failed to fetch RCA report: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }
}
