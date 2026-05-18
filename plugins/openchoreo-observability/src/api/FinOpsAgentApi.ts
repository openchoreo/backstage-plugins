import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';
import { ObserverUrlCache } from './ObserverUrlCache';

export interface FinOpsRoutingContext {
  namespaceName: string;
  environmentName: string;
}

export interface FinOpsAgentApi {
  updateActionStatuses(
    reportId: string,
    routing: FinOpsRoutingContext,
    update: { appliedIndices?: number[]; dismissedIndices?: number[] },
  ): Promise<void>;
}

export const finopsAgentApiRef = createApiRef<FinOpsAgentApi>({
  id: 'plugin.openchoreo-finops-agent.service',
});

export class FinOpsAgentClient implements FinOpsAgentApi {
  private readonly fetchApi: FetchApi;
  private readonly urlCache: ObserverUrlCache;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.fetchApi = options.fetchApi;
    this.urlCache = new ObserverUrlCache(options);
  }

  async updateActionStatuses(
    reportId: string,
    routing: FinOpsRoutingContext,
    update: { appliedIndices?: number[]; dismissedIndices?: number[] },
  ): Promise<void> {
    const { finopsAgentUrl } = await this.urlCache.resolveUrls(
      routing.namespaceName,
      routing.environmentName,
    );

    if (!finopsAgentUrl) {
      throw new Error('FinOps service is not configured');
    }

    const response = await this.fetchApi.fetch(
      `${finopsAgentUrl}/api/v1alpha1/reports/${encodeURIComponent(reportId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(update),
        headers: {
          'Content-Type': 'application/json',
          'x-openchoreo-direct': 'true',
        },
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.detail || `Update report failed: ${response.statusText}`,
      );
    }
  }
}
