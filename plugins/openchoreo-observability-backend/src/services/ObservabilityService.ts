import {
  coreServices,
  createServiceFactory,
  createServiceRef,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { Expand } from '@backstage/types';
import {
  createOpenChoreoApiClient,
  createObservabilityClientWithUrl,
  ObservabilityUrlResolver,
} from '@openchoreo/openchoreo-client-node';
import { ComponentMetricsTimeSeries, Environment } from '../types';

export interface RuntimeLogsResponse {
  logs: Array<{
    timestamp: string;
    log: string;
    level: string;
    metadata?: {
      componentName?: string;
      projectName?: string;
      environmentName?: string;
      namespaceName?: string;
      componentUid?: string;
      projectUid?: string;
      environmentUid?: string;
      containerName?: string;
      podName?: string;
      podNamespace?: string;
    };
  }>;
  total: number;
  tookMs: number;
}

/**
 * Error thrown when observability is not configured for a component
 */
export class ObservabilityNotConfiguredError extends Error {
  constructor(componentId: string) {
    super(`Observability is not configured for component ${componentId}`);
    this.name = 'ObservabilityNotConfiguredError';
  }
}

/**
 * Extracts the actual error message from an openapi-fetch error object
 */
function extractErrorMessage(error: unknown, response: Response): string {
  if (!error) {
    return `HTTP ${response.status} ${response.statusText}`;
  }

  const err = error as Record<string, unknown>;
  if (typeof err.error === 'string') {
    return err.error;
  }
  if (typeof err.message === 'string') {
    return err.message;
  }
  return JSON.stringify(error);
}

export class ObservabilityService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;
  private readonly resolver: ObservabilityUrlResolver;

  static create(logger: LoggerService, baseUrl: string): ObservabilityService {
    return new ObservabilityService(logger, baseUrl);
  }

  private constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.resolver = new ObservabilityUrlResolver({ baseUrl, logger });
  }

  /**
   * Resolves both the observer and RCA agent URLs for a given namespace and environment.
   * Used by the frontend to make direct calls to observer/RCA APIs.
   */
  async resolveUrls(
    namespaceName: string,
    environmentName: string,
    userToken?: string,
  ): Promise<{ observerUrl?: string; rcaAgentUrl?: string }> {
    return this.resolver.resolveForEnvironment(
      namespaceName,
      environmentName,
      userToken,
    );
  }

  /**
   * Resolves the observability URL for a given namespace and environment.
   */
  private async resolveObserverUrl(
    namespaceName: string,
    environmentName: string,
    userToken?: string,
  ): Promise<string> {
    if (!environmentName) {
      throw new Error('Environment is required to resolve observer URL');
    }

    const { observerUrl } = await this.resolver.resolveForEnvironment(
      namespaceName,
      environmentName,
      userToken,
    );

    if (!observerUrl) {
      throw new ObservabilityNotConfiguredError(namespaceName);
    }

    this.logger.debug(
      `Resolved observer URL: ${observerUrl} for namespace ${namespaceName}, environment ${environmentName}`,
    );

    return observerUrl;
  }

  /**
   * Fetches environments for observability filtering purposes.
   *
   * @param namespaceName - The namespace name
   * @param userToken - Optional user token for authentication (takes precedence over default token)
   */
  async fetchEnvironmentsByNamespace(
    namespaceName: string,
    userToken?: string,
  ): Promise<Environment[]> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Starting environment fetch for namespace: ${namespaceName}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
        token: userToken,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/environments',
        {
          params: {
            path: { namespaceName },
          },
        },
      );

      if (error || !response.ok) {
        this.logger.error(
          `Failed to fetch environments for namespace ${namespaceName}: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      if (!data?.items) {
        this.logger.warn(
          `No environments found for namespace ${namespaceName}`,
        );
        return [];
      }

      const environments: Environment[] = data.items.map((item: any) => ({
        uid: item.metadata?.uid ?? '',
        name: item.metadata?.name ?? '',
        namespace: item.metadata?.namespace ?? '',
        isProduction: item.spec?.isProduction ?? false,
        dataPlaneRef: item.spec?.dataPlaneRef,
        createdAt: item.metadata?.creationTimestamp ?? '',
      }));

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Environment fetch completed: ${environments.length} environments found (${totalTime}ms)`,
      );

      return environments;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching environments for namespace ${namespaceName} (${totalTime}ms):`,
        error as Error,
      );
      return [];
    }
  }

  /**
   * Fetches runtime logs for a specific component.
   *
   * @param componentId - The ID of the component
   * @param projectId - The ID of the project
   * @param environmentId - The ID of the environment
   * @param namespaceName - The namespace name
   * @param projectName - The project name
   * @param environmentName - The name of the environment
   * @param componentName - The name of the component
   * @param options - Optional parameters for filtering runtime logs
   * @param options.limit - The maximum number of runtime logs to return
   * @param options.startTime - The start time of the runtime logs
   * @param options.endTime - The end time of the runtime logs
   * @param options.logLevels - The log levels to filter by
   * @param userToken - Optional user token for authentication (takes precedence over default token)
   * @returns Promise<RuntimeLogsResponse> - The runtime logs data
   */
  async fetchRuntimeLogsByComponent(
    _componentId: string,
    _projectId: string,
    _environmentId: string,
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
    userToken?: string,
  ): Promise<RuntimeLogsResponse> {
    const startTime = Date.now();
    try {
      this.logger.info(
        `Fetching runtime logs for component ${componentName} in namespace ${namespaceName} and environment ${environmentName}`,
      );

      const observerUrl = await this.resolveObserverUrl(
        namespaceName,
        environmentName,
        userToken,
      );

      const obsClient = createObservabilityClientWithUrl(
        observerUrl,
        userToken,
        this.logger,
      );

      this.logger.debug(
        `Sending runtime logs request for component ${componentName} with limit: ${
          options?.limit || 100
        }`,
      );

      const { data, error, response } = await obsClient.POST(
        '/api/v1/logs/query',
        {
          body: {
            startTime:
              options?.startTime ||
              new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Default: 1 hour ago
            endTime: options?.endTime || new Date().toISOString(), // Default: now
            limit: options?.limit || 100,
            sortOrder: options?.sortOrder || 'desc',
            ...(options?.logLevels &&
              options.logLevels.length > 0 && {
                logLevels: options.logLevels as (
                  | 'DEBUG'
                  | 'INFO'
                  | 'WARN'
                  | 'ERROR'
                )[],
              }),
            ...(options?.searchQuery && { searchPhrase: options.searchQuery }),
            searchScope: {
              namespace: namespaceName,
              project: projectName,
              component: componentName,
              environment: environmentName,
            },
          },
        },
      );

      if (error || !response.ok) {
        const errorMessage = extractErrorMessage(error, response);
        this.logger.error(
          `Failed to fetch runtime logs for component ${componentName}: ${errorMessage}`,
        );
        throw new Error(`Failed to fetch runtime logs: ${errorMessage}`);
      }

      this.logger.debug(
        `Successfully fetched ${
          data.logs?.length || 0
        } runtime logs for component ${componentName}`,
      );

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Runtime logs fetch completed for component ${componentName} (${totalTime}ms)`,
      );

      return {
        logs:
          data.logs?.map(rawLog => ({
            timestamp: rawLog.timestamp || '',
            log: rawLog.log || '',
            level: (rawLog as any).level || 'INFO',
            metadata: (rawLog as any).metadata,
          })) || [],
        total: data.total || 0,
        tookMs: data.tookMs || 0,
      };
    } catch (error: unknown) {
      if (error instanceof ObservabilityNotConfiguredError) {
        this.logger.info(
          `Observability not configured for component ${componentName}`,
        );
        throw error;
      }

      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching runtime logs for component ${componentName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Fetches metrics for a specific component.
   * This method dynamically resolves the observability URL from the main API,
   * then fetches metrics from the observability service.
   *
   * @param componentId - The ID of the component
   * @param projectId - The ID of the project
   * @param environmentId - The ID of the environment
   * @param namespaceName - The namespace name
   * @param projectName - The project name
   * @param environmentName - The name of the environment
   * @param componentName - The name of the component
   * @param options - Optional parameters for filtering metrics
   * @param options.limit - The maximum number of metrics to return
   * @param options.offset - The offset from the first metric to return
   * @param options.startTime - The start time of the metrics
   * @param options.endTime - The end time of the metrics
   * @param userToken - Optional user token for authentication (takes precedence over default token)
   * @returns Promise<ResourceMetricsTimeSeries> - The metrics data
   */
  async fetchMetricsByComponent(
    componentId: string,
    projectId: string,
    environmentId: string,
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName: string,
    options?: {
      limit?: number;
      offset?: number;
      startTime?: string;
      endTime?: string;
    },
    userToken?: string,
  ): Promise<ComponentMetricsTimeSeries> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching metrics for component ${componentName} in environment ${environmentName}`,
      );

      // Resolve the observer URL using the helper function
      const observerUrl = await this.resolveObserverUrl(
        namespaceName,
        environmentName,
        userToken,
      );

      // Use the observability client with the resolved URL
      const obsClient = createObservabilityClientWithUrl(
        observerUrl,
        userToken,
        this.logger,
      );

      this.logger.debug(
        `Sending metrics request for component ${componentId} with limit: ${
          options?.limit || 100
        }`,
      );

      const { data, error, response } = await obsClient.POST(
        '/api/metrics/component/usage',
        {
          body: {
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
          },
        },
      );

      const {
        data: httpData,
        error: httpError,
        response: httpResponse,
      } = await obsClient.POST('/api/metrics/component/http', {
        body: {
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
        },
      });

      if (error || !response.ok) {
        const errorMessage = extractErrorMessage(error, response);
        this.logger.error(
          `Failed to fetch metrics for component ${componentId}: ${errorMessage}`,
        );
        throw new Error(`Failed to fetch metrics: ${errorMessage}`);
      }

      if (httpError || !httpResponse.ok) {
        const errorMessage = extractErrorMessage(httpError, httpResponse);
        this.logger.error(
          `Failed to fetch HTTP metrics for component ${componentId}: ${errorMessage}`,
        );
        throw new Error(`Failed to fetch HTTP metrics: ${errorMessage}`);
      }

      this.logger.debug(
        `Successfully fetched metrics for component ${componentId}: ${JSON.stringify(
          data,
        )}`,
      );

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Metrics fetch completed for component ${componentId} (${totalTime}ms)`,
      );

      // return {...data};
      // TODO: Fix the ObservabilityClient to return empty arrays if the data is not available
      return {
        cpuUsage: data.cpuUsage ?? [],
        cpuRequests: data.cpuRequests ?? [],
        cpuLimits: data.cpuLimits ?? [],
        memory: data.memory ?? [],
        memoryRequests: data.memoryRequests ?? [],
        memoryLimits: data.memoryLimits ?? [],
        requestCount: httpData.requestCount ?? [],
        successfulRequestCount: httpData.successfulRequestCount ?? [],
        unsuccessfulRequestCount: httpData.unsuccessfulRequestCount ?? [],
        meanLatency: httpData.meanLatency ?? [],
        latencyPercentile50th: httpData.latencyPercentile50th ?? [],
        latencyPercentile90th: httpData.latencyPercentile90th ?? [],
        latencyPercentile99th: httpData.latencyPercentile99th ?? [],
      };
    } catch (error: unknown) {
      if (error instanceof ObservabilityNotConfiguredError) {
        this.logger.info(
          `Observability not configured for component ${componentId}`,
        );
        throw error;
      }

      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching metrics for component ${componentId} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Fetches traces for a specific project.
   * This method dynamically resolves the observability URL from the main API,
   * then fetches traces from the observability service.
   *
   * @param projectId - The ID of the project
   * @param environmentId - The ID of the environment
   * @param namespaceName - The namespace name
   * @param projectName - The project name
   * @param environmentName - The name of the environment
   * @param componentUids - Array of component UIDs to filter traces (optional)
   * @param options - Optional parameters for filtering traces
   * @param options.limit - The maximum number of traces to return
   * @param options.startTime - The start time of the traces
   * @param options.endTime - The end time of the traces
   * @param options.traceId - Trace ID to filter by (optional, supports wildcards)
   * @param options.sortOrder - Sort order for traces (asc/desc)
   * @param userToken - Optional user token for authentication (takes precedence over default token)
   * @returns Promise with traces data
   */
  async fetchTracesByProject(
    projectId: string,
    environmentId: string,
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentUids: string[],
    componentNames: string[],
    options?: {
      limit?: number;
      startTime?: string;
      endTime?: string;
      traceId?: string;
      sortOrder?: 'asc' | 'desc';
    },
    userToken?: string,
  ): Promise<{
    traces: Array<{
      traceId: string;
      spans: Array<{
        spanId: string;
        name: string;
        durationNanoseconds: number;
        startTime: string;
        endTime: string;
        parentSpanId?: string;
      }>;
    }>;
    tookMs: number;
  }> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching traces for project ${projectName} in environment ${
          environmentName || 'all'
        }`,
      );

      // Resolve the observer URL using the helper function
      const observerUrl = await this.resolveObserverUrl(
        namespaceName,
        environmentName,
        userToken,
      );

      // Use the observability client with the resolved URL
      const obsClient = createObservabilityClientWithUrl(
        observerUrl,
        userToken,
        this.logger,
      );

      this.logger.debug(
        `Sending traces request to ${observerUrl}/api/traces for project ${projectId} with limit: ${
          options?.limit || 100
        }`,
      );

      if (!options?.startTime || !options?.endTime) {
        throw new Error('startTime and endTime are required to fetch traces');
      }

      const requestBody = {
        projectUid: projectId,
        componentUids: componentUids.length > 0 ? componentUids : undefined,
        environmentUid: environmentId,
        traceId: options?.traceId,
        startTime: options.startTime,
        endTime: options.endTime,
        limit: options?.limit || 100,
        sortOrder: options?.sortOrder || 'desc',
        componentNames,
        projectName,
        namespaceName,
        environmentName,
      };

      this.logger.debug(
        `Calling POST ${observerUrl}/api/traces with body: ${JSON.stringify(
          requestBody,
        )}`,
      );

      const { data, error, response } = await obsClient.POST('/api/traces', {
        body: requestBody,
      });

      if (error || !response.ok) {
        const errorMessage = extractErrorMessage(error, response);
        const fullUrl = `${observerUrl}/api/traces`;
        this.logger.error(
          `Failed to fetch traces for project ${projectId} from ${fullUrl}: ${errorMessage}`,
        );
        throw new Error(
          `Failed to fetch traces from ${fullUrl}: ${errorMessage}`,
        );
      }

      this.logger.debug(
        `Successfully fetched traces for project ${projectId}: ${
          data?.traces?.length || 0
        } traces`,
      );

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Traces fetch completed for project ${projectId} (${totalTime}ms)`,
      );

      return {
        traces:
          data?.traces?.map(trace => ({
            traceId: trace.traceId!,
            spans:
              trace.spans?.map(span => ({
                spanId: span.spanId!,
                name: span.name!,
                durationNanoseconds: span.durationNanoseconds!,
                startTime: span.startTime!,
                endTime: span.endTime!,
                parentSpanId: span.parentSpanId ?? undefined,
              })) || [],
          })) || [],
        tookMs: data?.tookMs || 0,
      };
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching traces for project ${projectId} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }
}

export const observabilityServiceRef = createServiceRef<
  Expand<ObservabilityService>
>({
  id: 'openchoreo.observability',
  defaultFactory: async service =>
    createServiceFactory({
      service,
      deps: {
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async factory(deps) {
        // Read configuration from app-config.yaml
        const baseUrl =
          deps.config.getOptionalString('openchoreo.baseUrl') ||
          'http://localhost:8080';
        return ObservabilityService.create(deps.logger, baseUrl);
      },
    }),
});
