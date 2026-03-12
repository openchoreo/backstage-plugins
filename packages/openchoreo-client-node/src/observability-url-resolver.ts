import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoClientConfig,
} from './factory';

/** Resolved observability URLs for an environment or build context. */
export interface ObservabilityUrlsResult {
  observerUrl?: string;
  rcaAgentUrl?: string;
}

/** Options for constructing an ObservabilityUrlResolver. */
export interface ObservabilityUrlResolverOptions {
  baseUrl: string;
  logger?: LoggerService;
  /** Cache TTL in milliseconds. Defaults to 5 minutes. */
  cacheTtlMs?: number;
}

interface CacheEntry {
  result: ObservabilityUrlsResult;
  expiresAt: number;
}

const DEFAULT_PLANE_NAME = 'default';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Resolves observer and RCA agent URLs by traversing the Kubernetes resource
 * reference chain using the OpenChoreo CRUD API.
 *
 * **Runtime observability** (environment-based):
 *   Environment → DataPlane (or ClusterDataPlane) → ObservabilityPlane → observerURL / rcaAgentURL
 *
 * **Build observability** (project-based):
 *   Project → WorkflowPlane (or ClusterWorkflowPlane) → ObservabilityPlane → observerURL
 */
export class ObservabilityUrlResolver {
  private readonly baseUrl: string;
  private readonly logger?: LoggerService;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: ObservabilityUrlResolverOptions) {
    this.baseUrl = options.baseUrl;
    this.logger = options.logger;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  /**
   * Resolve observability URLs for a runtime environment.
   *
   * Chain: Environment → DataPlane/ClusterDataPlane → ObservabilityPlane/ClusterObservabilityPlane
   */
  async resolveForEnvironment(
    namespaceName: string,
    envName: string,
    token?: string,
  ): Promise<ObservabilityUrlsResult> {
    const cacheKey = `env:${namespaceName}/${envName}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const client = this.createClient(token);

    // Step 1: Get the environment to read its dataPlaneRef
    const {
      data: env,
      error: envError,
      response: envResp,
    } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/environments/{envName}',
      { params: { path: { namespaceName, envName } } },
    );
    if (envError || !envResp.ok) {
      throw new Error(
        `Failed to get environment '${envName}': ${envResp.status} ${envResp.statusText}`,
      );
    }

    const dataPlaneRef = (env as any)?.spec?.dataPlaneRef;

    // Step 2: Get the DataPlane or ClusterDataPlane
    let observabilityPlaneRef: { kind: string; name: string } | undefined;

    if (!dataPlaneRef || dataPlaneRef.kind === 'DataPlane') {
      const dpName = dataPlaneRef?.name ?? DEFAULT_PLANE_NAME;
      const {
        data: dp,
        error: dpError,
        response: dpResp,
      } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/dataplanes/{dpName}',
        { params: { path: { namespaceName, dpName } } },
      );
      if (dpError || !dpResp.ok) {
        throw new Error(
          `Failed to get DataPlane '${dpName}': ${dpResp.status} ${dpResp.statusText}`,
        );
      }
      const ref = (dp as any)?.spec?.observabilityPlaneRef;
      observabilityPlaneRef = ref ?? {
        kind: 'ObservabilityPlane',
        name: DEFAULT_PLANE_NAME,
      };
    } else if (dataPlaneRef.kind === 'ClusterDataPlane') {
      const cdpName = dataPlaneRef.name;
      const {
        data: cdp,
        error: cdpError,
        response: cdpResp,
      } = await client.GET('/api/v1/clusterdataplanes/{cdpName}', {
        params: { path: { cdpName } },
      });
      if (cdpError || !cdpResp.ok) {
        throw new Error(
          `Failed to get ClusterDataPlane '${cdpName}': ${cdpResp.status} ${cdpResp.statusText}`,
        );
      }
      const ref = (cdp as any)?.spec?.observabilityPlaneRef;
      observabilityPlaneRef = ref ?? {
        kind: 'ClusterObservabilityPlane',
        name: DEFAULT_PLANE_NAME,
      };
    } else {
      throw new Error(`Unsupported dataPlaneRef kind '${dataPlaneRef.kind}'`);
    }

    // Step 3: Get the ObservabilityPlane or ClusterObservabilityPlane
    const result = await this.getObservabilityPlaneUrls(
      client,
      namespaceName,
      observabilityPlaneRef!,
    );

    this.putInCache(cacheKey, result);
    return result;
  }

  /**
   * Resolve observability URLs for build logs (project-based).
   *
   * Chain: Project → WorkflowPlane/ClusterWorkflowPlane → ObservabilityPlane/ClusterObservabilityPlane
   */
  async resolveForBuild(
    namespaceName: string,
    projectName: string,
    token?: string,
  ): Promise<ObservabilityUrlsResult> {
    const cacheKey = `build:${namespaceName}/${projectName}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const client = this.createClient(token);

    // Step 1: Get the project to read its workflowPlaneRef
    const {
      data: project,
      error: projError,
      response: projResp,
    } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/projects/{projectName}',
      { params: { path: { namespaceName, projectName } } },
    );
    if (projError || !projResp.ok) {
      throw new Error(
        `Failed to get project '${projectName}': ${projResp.status} ${projResp.statusText}`,
      );
    }

    const workflowPlaneRef = (project as any)?.spec?.workflowPlaneRef;

    // Step 2: Get the WorkflowPlane or ClusterWorkflowPlane
    let observabilityPlaneRef: { kind: string; name: string } | undefined;

    if (!workflowPlaneRef || workflowPlaneRef.kind === 'WorkflowPlane') {
      const bpName = workflowPlaneRef?.name ?? DEFAULT_PLANE_NAME;
      const {
        data: bp,
        error: bpError,
        response: bpResp,
      } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/workflowplanes/{workflowPlaneName}',
        { params: { path: { namespaceName, workflowPlaneName: bpName } } },
      );

      if (bpError || !bpResp.ok) {
        // Fallback: try ClusterWorkflowPlane "default" (matches Go backend behavior)
        if (bpResp.status === 404 && !workflowPlaneRef) {
          this.logger?.debug(
            `WorkflowPlane '${bpName}' not found in namespace '${namespaceName}', trying ClusterWorkflowPlane '${DEFAULT_PLANE_NAME}'`,
          );
          return this.resolveForBuildViaClusterWorkflowPlane(
            client,
            namespaceName,
            DEFAULT_PLANE_NAME,
            cacheKey,
          );
        }
        throw new Error(
          `Failed to get WorkflowPlane '${bpName}': ${bpResp.status} ${bpResp.statusText}`,
        );
      }
      const ref = (bp as any)?.spec?.observabilityPlaneRef;
      observabilityPlaneRef = ref ?? {
        kind: 'ObservabilityPlane',
        name: DEFAULT_PLANE_NAME,
      };
    } else if (workflowPlaneRef.kind === 'ClusterWorkflowPlane') {
      return this.resolveForBuildViaClusterWorkflowPlane(
        client,
        namespaceName,
        workflowPlaneRef.name,
        cacheKey,
      );
    } else {
      throw new Error(
        `Unsupported workflowPlaneRef kind '${workflowPlaneRef.kind}'`,
      );
    }

    // Step 3: Get the ObservabilityPlane or ClusterObservabilityPlane
    const result = await this.getObservabilityPlaneUrls(
      client,
      namespaceName,
      observabilityPlaneRef!,
    );

    this.putInCache(cacheKey, result);
    return result;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private createClient(token?: string) {
    return createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    } as OpenChoreoClientConfig);
  }

  private async resolveForBuildViaClusterWorkflowPlane(
    client: ReturnType<typeof createOpenChoreoApiClient>,
    namespaceName: string,
    clusterWorkflowPlaneName: string,
    cacheKey: string,
  ): Promise<ObservabilityUrlsResult> {
    const {
      data: cbp,
      error: cbpError,
      response: cbpResp,
    } = await client.GET(
      '/api/v1/clusterworkflowplanes/{clusterWorkflowPlaneName}',
      {
        params: { path: { clusterWorkflowPlaneName } },
      },
    );
    if (cbpError || !cbpResp.ok) {
      throw new Error(
        `Failed to get ClusterWorkflowPlane '${clusterWorkflowPlaneName}': ${cbpResp.status} ${cbpResp.statusText}`,
      );
    }
    const ref = (cbp as any)?.spec?.observabilityPlaneRef;
    const observabilityPlaneRef = ref ?? {
      kind: 'ClusterObservabilityPlane',
      name: DEFAULT_PLANE_NAME,
    };

    const result = await this.getObservabilityPlaneUrls(
      client,
      namespaceName,
      observabilityPlaneRef,
    );
    this.putInCache(cacheKey, result);
    return result;
  }

  private async getObservabilityPlaneUrls(
    client: ReturnType<typeof createOpenChoreoApiClient>,
    namespaceName: string,
    ref: { kind: string; name: string },
  ): Promise<ObservabilityUrlsResult> {
    if (ref.kind === 'ObservabilityPlane') {
      const {
        data: op,
        error: opError,
        response: opResp,
      } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/observabilityplanes/{observabilityPlaneName}',
        {
          params: {
            path: { namespaceName, observabilityPlaneName: ref.name },
          },
        },
      );
      if (opError || !opResp.ok) {
        if (opResp.status === 404) {
          this.logger?.info(
            `ObservabilityPlane '${ref.name}' not found in namespace '${namespaceName}', observability is not configured`,
          );
          return {};
        }
        throw new Error(
          `Failed to get ObservabilityPlane '${ref.name}': ${opResp.status} ${opResp.statusText}`,
        );
      }
      return {
        observerUrl: (op as any)?.spec?.observerURL,
        rcaAgentUrl: (op as any)?.spec?.rcaAgentURL,
      };
    }

    if (ref.kind === 'ClusterObservabilityPlane') {
      const {
        data: cop,
        error: copError,
        response: copResp,
      } = await client.GET(
        '/api/v1/clusterobservabilityplanes/{clusterObservabilityPlaneName}',
        {
          params: {
            path: { clusterObservabilityPlaneName: ref.name },
          },
        },
      );
      if (copError || !copResp.ok) {
        if (copResp.status === 404) {
          this.logger?.info(
            `ClusterObservabilityPlane '${ref.name}' not found, observability is not configured`,
          );
          return {};
        }
        throw new Error(
          `Failed to get ClusterObservabilityPlane '${ref.name}': ${copResp.status} ${copResp.statusText}`,
        );
      }
      return {
        observerUrl: (cop as any)?.spec?.observerURL,
        rcaAgentUrl: (cop as any)?.spec?.rcaAgentURL,
      };
    }

    throw new Error(`Unsupported observabilityPlaneRef kind '${ref.kind}'`);
  }

  private getFromCache(key: string): ObservabilityUrlsResult | undefined {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      this.logger?.debug(`ObservabilityUrlResolver cache hit for '${key}'`);
      return entry.result;
    }
    if (entry) {
      this.cache.delete(key);
    }
    return undefined;
  }

  private putInCache(key: string, result: ObservabilityUrlsResult): void {
    // Don't cache empty results (e.g. from 404s) so they are re-checked on the next request
    if (!result.observerUrl && !result.rcaAgentUrl) {
      return;
    }
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }
}
