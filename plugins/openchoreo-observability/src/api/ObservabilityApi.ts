import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';
import { UsageMetrics } from '../types';

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
  ): Promise<UsageMetrics>;
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
  ): Promise<UsageMetrics> {
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
    };
  }
}
