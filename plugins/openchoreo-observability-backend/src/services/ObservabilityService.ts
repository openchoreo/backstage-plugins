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
  ObservabilityComponents,
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
   * then fetches metrics from the observability service using the unified
   * POST /api/v1/metrics/query endpoint.
   *
   * @param namespaceName - The namespace name
   * @param projectName - The project name
   * @param environmentName - The name of the environment
   * @param componentName - The name of the component
   * @param options - Optional parameters for filtering metrics
   * @param options.startTime - The start time of the metrics (ISO 8601)
   * @param options.endTime - The end time of the metrics (ISO 8601)
   * @param options.step - Resolution step (e.g. '1m', '5m', '15m')
   * @param userToken - Optional user token for authentication (takes precedence over default token)
   * @returns Promise<ComponentMetricsTimeSeries> - The metrics data
   */
  async fetchMetricsByComponent(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName: string,
    options?: {
      startTime?: string;
      endTime?: string;
      step?: string;
    },
    userToken?: string,
  ): Promise<ComponentMetricsTimeSeries> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching metrics for component ${componentName} in environment ${environmentName}`,
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

      this.logger.debug(
        `Sending metrics request for component ${componentName}`,
      );

      const [
        { data, error, response },
        { data: httpData, error: httpError, response: httpResponse },
      ] = await Promise.all([
        obsClient.POST('/api/v1/metrics/query', {
          body: { ...baseBody, metric: 'resource' },
        }),
        obsClient.POST('/api/v1/metrics/query', {
          body: { ...baseBody, metric: 'http' },
        }),
      ]);

      if (error || !response.ok) {
        const errorMessage = extractErrorMessage(error, response);
        this.logger.error(
          `Failed to fetch resource metrics for component ${componentName}: ${errorMessage}`,
        );
        throw new Error(`Failed to fetch metrics: ${errorMessage}`);
      }

      if (httpError || !httpResponse.ok) {
        const errorMessage = extractErrorMessage(httpError, httpResponse);
        this.logger.error(
          `Failed to fetch HTTP metrics for component ${componentName}: ${errorMessage}`,
        );
        throw new Error(`Failed to fetch HTTP metrics: ${errorMessage}`);
      }

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Metrics fetch completed for component ${componentName} (${totalTime}ms)`,
      );

      const resourceData =
        data as ObservabilityComponents['schemas']['ResourceMetricsTimeSeries'];
      const httpMetricsData =
        httpData as ObservabilityComponents['schemas']['HttpMetricsTimeSeries'];

      return {
        cpuUsage: resourceData.cpuUsage ?? [],
        cpuRequests: resourceData.cpuRequests ?? [],
        cpuLimits: resourceData.cpuLimits ?? [],
        memoryUsage: resourceData.memoryUsage ?? [],
        memoryRequests: resourceData.memoryRequests ?? [],
        memoryLimits: resourceData.memoryLimits ?? [],
        requestCount: httpMetricsData.requestCount ?? [],
        successfulRequestCount: httpMetricsData.successfulRequestCount ?? [],
        unsuccessfulRequestCount:
          httpMetricsData.unsuccessfulRequestCount ?? [],
        meanLatency: httpMetricsData.meanLatency ?? [],
        latencyP50: httpMetricsData.latencyP50 ?? [],
        latencyP90: httpMetricsData.latencyP90 ?? [],
        latencyP99: httpMetricsData.latencyP99 ?? [],
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
        `Error fetching metrics for component ${componentName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Fetches traces for a project/component using the v1alpha1 traces query endpoint.
   *
   * @param namespaceName - The namespace name
   * @param projectName - The project name
   * @param environmentName - The name of the environment
   * @param componentName - Optional component name to filter traces
   * @param options - Optional parameters for filtering traces
   * @param options.limit - The maximum number of traces to return (default 100)
   * @param options.startTime - The start time of the query (ISO 8601)
   * @param options.endTime - The end time of the query (ISO 8601)
   * @param options.sort - Sort order for traces (asc/desc, default desc)
   * @param userToken - Optional user token for authentication
   * @returns Promise with traces data
   */
  async fetchTraces(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName?: string,
    options?: {
      limit?: number;
      startTime?: string;
      endTime?: string;
      sort?: 'asc' | 'desc';
    },
    userToken?: string,
  ): Promise<{
    traces: Array<
      NonNullable<
        ObservabilityComponents['schemas']['TracesQueryResponse']['traces']
      >[number]
    >;
    total: number;
    tookMs: number;
  }> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching traces for project ${projectName} in environment ${environmentName}`,
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

      if (!options?.startTime || !options?.endTime) {
        throw new Error('startTime and endTime are required to fetch traces');
      }

      const { data, error, response } = await obsClient.POST(
        '/api/v1alpha1/traces/query',
        {
          body: {
            startTime: options.startTime,
            endTime: options.endTime,
            limit: options?.limit ?? 100,
            sort: options?.sort ?? 'desc',
            searchScope: {
              namespace: namespaceName,
              project: projectName,
              ...(componentName ? { component: componentName } : {}),
              environment: environmentName,
            },
          },
        },
      );

      if (error || !response.ok) {
        const errorMessage = extractErrorMessage(error, response);
        this.logger.error(
          `Failed to fetch traces for project ${projectName}: ${errorMessage}`,
        );
        throw new Error(`Failed to fetch traces: ${errorMessage}`);
      }

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Traces fetch completed for project ${projectName}: ${
          data?.traces?.length ?? 0
        } traces (${totalTime}ms)`,
      );

      return {
        traces: data?.traces ?? [],
        total: data?.total ?? 0,
        tookMs: data?.tookMs ?? 0,
      };
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching traces for project ${projectName} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Fetches spans for a specific trace using the v1alpha1 spans query endpoint.
   *
   * @param traceId - The ID of the trace
   * @param namespaceName - The namespace name
   * @param projectName - The project name
   * @param environmentName - The name of the environment
   * @param componentName - Optional component name
   * @param options - Optional parameters
   * @param options.startTime - The start time of the query (ISO 8601)
   * @param options.endTime - The end time of the query (ISO 8601)
   * @param userToken - Optional user token for authentication
   * @returns Promise with spans data
   */
  async fetchTraceSpans(
    traceId: string,
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName?: string,
    options?: {
      startTime?: string;
      endTime?: string;
    },
    userToken?: string,
  ): Promise<{
    spans: Array<
      NonNullable<
        ObservabilityComponents['schemas']['TraceSpansQueryResponse']['spans']
      >[number]
    >;
    total: number;
    tookMs: number;
  }> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching spans for trace ${traceId} in environment ${environmentName}`,
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

      if (!options?.startTime || !options?.endTime) {
        throw new Error(
          'startTime and endTime are required to fetch trace spans',
        );
      }

      const { data, error, response } = await obsClient.POST(
        '/api/v1alpha1/traces/{traceId}/spans/query',
        {
          params: { path: { traceId } },
          body: {
            startTime: options.startTime,
            endTime: options.endTime,
            limit: 1000,
            sort: 'asc',
            searchScope: {
              namespace: namespaceName,
              project: projectName,
              ...(componentName ? { component: componentName } : {}),
              environment: environmentName,
            },
          },
        },
      );

      if (error || !response.ok) {
        const errorMessage = extractErrorMessage(error, response);
        this.logger.error(
          `Failed to fetch spans for trace ${traceId}: ${errorMessage}`,
        );
        throw new Error(
          `Failed to fetch spans for trace ${traceId}: ${errorMessage}`,
        );
      }

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Spans fetch completed for trace ${traceId}: ${
          data?.spans?.length ?? 0
        } spans (${totalTime}ms)`,
      );

      return {
        spans: data?.spans ?? [],
        total: data?.total ?? 0,
        tookMs: data?.tookMs ?? 0,
      };
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching spans for trace ${traceId} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Fetches details for a specific span, including attributes.
   *
   * @param traceId - The ID of the trace
   * @param spanId - The ID of the span
   * @param namespaceName - The namespace name
   * @param environmentName - The name of the environment
   * @param userToken - Optional user token for authentication
   * @returns Promise with span details including attributes
   */
  async fetchSpanDetails(
    traceId: string,
    spanId: string,
    namespaceName: string,
    environmentName: string,
    userToken?: string,
  ): Promise<ObservabilityComponents['schemas']['TraceSpanDetailsResponse']> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching details for span ${spanId} in trace ${traceId}`,
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

      const { data, error, response } = await obsClient.GET(
        '/api/v1alpha1/traces/{traceId}/spans/{spanId}',
        {
          params: { path: { traceId, spanId } },
        },
      );

      if (error || !response.ok) {
        const errorMessage = extractErrorMessage(error, response);
        this.logger.error(
          `Failed to fetch details for span ${spanId}: ${errorMessage}`,
        );
        throw new Error(
          `Failed to fetch span details for span ${spanId}: ${errorMessage}`,
        );
      }

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Span details fetch completed for span ${spanId} (${totalTime}ms)`,
      );

      return data ?? {};
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching span details for span ${spanId} (${totalTime}ms):`,
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
