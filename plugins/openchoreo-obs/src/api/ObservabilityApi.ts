import { createApiRef, DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

export interface Metric {
  name: string;
  value: number;
  unit: string;
  status: string;
}

export interface MetricsResponse {
  timestamp: string;
  metrics: Metric[];
}

export interface ObservabilityApi {
  getMetrics(): Promise<MetricsResponse>;
}

export const observabilityApiRef = createApiRef<ObservabilityApi>({
  id: 'plugin.openchoreo-obs.service',
});

export class ObservabilityClient implements ObservabilityApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  async getMetrics(): Promise<MetricsResponse> {
    const baseUrl = await this.discoveryApi.getBaseUrl('openchoreo-obs-backend');
    const response = await this.fetchApi.fetch(`${baseUrl}/metrics`);

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.statusText}`);
    }

    return response.json();
  }
}
