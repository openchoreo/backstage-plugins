import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { AuditLogsNotEnabledError } from './AuditLogsErrors';

type ResolvedUrls = {
  observerUrl: string;
  rcaAgentUrl?: string;
  finopsAgentUrl?: string;
};

interface CachedUrls {
  observerUrl: string;
  rcaAgentUrl?: string;
  finopsAgentUrl?: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class ObserverUrlCache {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;
  private readonly cache = new Map<string, CachedUrls>();
  private readonly inFlight = new Map<string, Promise<ResolvedUrls>>();

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  /**
   * Resolves the observer serving platform-wide reads — the audit trail, which
   * has no environment to resolve through. Cached under its own key alongside
   * the per-environment entries.
   */
  async resolvePlatformUrls(): Promise<{ observerUrl: string }> {
    const cacheKey = 'platform';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return { observerUrl: cached.observerUrl };
    }

    const baseUrl = await this.discoveryApi.getBaseUrl(
      'openchoreo-observability-backend',
    );
    const response = await this.fetchApi.fetch(
      `${baseUrl}/resolve-platform-urls`,
    );

    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch {
        throw new Error(
          `Failed to resolve the platform observer URL: ${response.status} ${response.statusText}`,
        );
      }
      throw new Error(
        error.error ||
          `Failed to resolve the platform observer URL: ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (data?.auditLogsEnabled === false) {
      throw new AuditLogsNotEnabledError();
    }
    if (!data?.observerUrl) {
      throw new Error('Observability is not enabled for this deployment');
    }

    this.cache.set(cacheKey, {
      observerUrl: data.observerUrl,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return { observerUrl: data.observerUrl };
  }

  async resolveUrls(
    namespaceName: string,
    environmentName: string,
  ): Promise<ResolvedUrls> {
    const cacheKey = `${namespaceName}/${environmentName}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return {
        observerUrl: cached.observerUrl,
        rcaAgentUrl: cached.rcaAgentUrl,
        finopsAgentUrl: cached.finopsAgentUrl,
      };
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) return pending;

    const request = this.fetchUrls(namespaceName, environmentName, cacheKey);
    this.inFlight.set(cacheKey, request);
    try {
      return await request;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private async fetchUrls(
    namespaceName: string,
    environmentName: string,
    cacheKey: string,
  ): Promise<ResolvedUrls> {
    const baseUrl = await this.discoveryApi.getBaseUrl(
      'openchoreo-observability-backend',
    );
    const url = new URL(`${baseUrl}/resolve-urls`);
    url.searchParams.set('namespaceName', namespaceName);
    url.searchParams.set('environmentName', environmentName);

    const response = await this.fetchApi.fetch(url.toString());

    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch {
        throw new Error(
          `Failed to resolve observer URLs: ${response.status} ${response.statusText}`,
        );
      }
      throw new Error(
        error.error ||
          `Failed to resolve observer URLs: ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (!data.observerUrl) {
      throw new Error('Observability is not enabled for this component');
    }

    this.cache.set(cacheKey, {
      observerUrl: data.observerUrl,
      rcaAgentUrl: data.rcaAgentUrl,
      finopsAgentUrl: data.finopsAgentUrl,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return {
      observerUrl: data.observerUrl,
      rcaAgentUrl: data.rcaAgentUrl,
      finopsAgentUrl: data.finopsAgentUrl,
    };
  }
}
