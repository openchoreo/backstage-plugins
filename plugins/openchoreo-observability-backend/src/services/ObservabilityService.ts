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
} from '@openchoreo/openchoreo-client-node';
import { Component, ComponentMetricsTimeSeries, Environment } from '../types';

/**
 * Error thrown when observability is not configured for a component
 */
export class ObservabilityNotConfiguredError extends Error {
  constructor(componentId: string) {
    super(`Observability is not configured for component ${componentId}`);
    this.name = 'ObservabilityNotConfiguredError';
  }
}

export class ObservabilityService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;

  static create(logger: LoggerService, baseUrl: string): ObservabilityService {
    return new ObservabilityService(logger, baseUrl);
  }

  private constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  /**
   * Resolves the observability URL for a given project and environment.
   * This is a temporary helper function to avoid code duplication.
   *
   * @param orgName - The organization name
   * @param projectName - The project name
   * @param environmentName - The environment name
   * @param userToken - Optional user token for authentication
   * @returns The resolved observer URL
   */
  private async resolveObserverUrl(
    orgName: string,
    projectName: string,
    environmentName: string,
    userToken?: string,
  ): Promise<string> {
    if (!environmentName) {
      throw new Error('Environment is required to resolve observer URL');
    }

    const mainClient = createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token: userToken,
      logger: this.logger,
    });

    // Get the list of components from the main API using the project
    const {
      data: componentsData,
      error: componentsError,
      response: componentsResponse,
    } = await mainClient.GET(
      '/orgs/{orgName}/projects/{projectName}/components',
      {
        params: { path: { orgName, projectName } },
      },
    );

    if (componentsError || !componentsResponse.ok) {
      throw new Error(
        `Failed to get components: ${componentsResponse.status} ${componentsResponse.statusText}`,
      );
    }

    if (!componentsData.success || !componentsData.data?.items) {
      throw new Error(
        `API returned unsuccessful response: ${JSON.stringify(componentsData)}`,
      );
    }

    const components = componentsData.data.items as Component[];

    if (!components || components.length === 0) {
      throw new Error(
        `No components found in project ${projectName}. Cannot get observer URL.`,
      );
    }

    const firstComponent = components[0];
    if (!firstComponent.name) {
      throw new Error(
        `Component name not found for first component in project ${projectName}`,
      );
    }

    this.logger.debug(
      `Using component ${firstComponent.name} to get observer URL for project ${projectName}`,
    );

    // Get observer URL from the main API using a component
    const {
      data: urlData,
      error: urlError,
      response: urlResponse,
    } = await mainClient.GET(
      '/orgs/{orgName}/projects/{projectName}/components/{componentName}/environments/{environmentName}/observer-url',
      {
        params: {
          path: {
            orgName,
            projectName,
            componentName: firstComponent.name,
            environmentName,
          },
        },
      },
    );

    if (urlError || !urlResponse.ok) {
      throw new Error(
        `Failed to get observer URL: ${urlResponse.status} ${urlResponse.statusText}`,
      );
    }

    if (!urlData.success || !urlData.data) {
      throw new Error(
        `API returned unsuccessful response: ${JSON.stringify(urlData)}`,
      );
    }

    const observerUrl = urlData.data.observerUrl;
    if (!observerUrl) {
      throw new ObservabilityNotConfiguredError(projectName);
    }

    this.logger.debug(
      `Resolved observer URL: ${observerUrl} for project ${projectName}, environment ${environmentName}`,
    );

    return observerUrl;
  }

  /**
   * Fetches environments for observability filtering purposes.
   *
   * @param organizationName - The organization name
   * @param userToken - Optional user token for authentication (takes precedence over default token)
   */
  async fetchEnvironmentsByOrganization(
    organizationName: string,
    userToken?: string,
  ): Promise<Environment[]> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Starting environment fetch for organization: ${organizationName}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
        token: userToken,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/environments',
        {
          params: {
            path: { orgName: organizationName },
          },
        },
      );

      if (error || !response.ok || !data) {
        this.logger.error(
          `Failed to fetch environments for organization ${organizationName}: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      if (!data.success || !data.data?.items) {
        this.logger.warn(
          `No environments found for organization ${organizationName}`,
        );
        return [];
      }

      const environments = data.data.items as Environment[];

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `Environment fetch completed: ${environments.length} environments found (${totalTime}ms)`,
      );

      return environments;
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching environments for organization ${organizationName} (${totalTime}ms):`,
        error as Error,
      );
      return [];
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
   * @param orgName - The organization name
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
    orgName: string,
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

      // First, get the observer URL from the main API
      const mainClient = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });
      const {
        data: urlData,
        error: urlError,
        response: urlResponse,
      } = await mainClient.GET(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/environments/{environmentName}/observer-url',
        {
          params: {
            path: { orgName, projectName, componentName, environmentName },
          },
        },
      );

      if (urlError || !urlResponse.ok) {
        throw new Error(
          `Failed to get observer URL: ${urlResponse.status} ${urlResponse.statusText}`,
        );
      }

      if (!urlData.success || !urlData.data) {
        throw new Error(
          `API returned unsuccessful response: ${JSON.stringify(urlData)}`,
        );
      }

      const observerUrl = urlData.data.observerUrl;
      if (!observerUrl) {
        throw new ObservabilityNotConfiguredError(componentName);
      }

      // Now use the observability client with the resolved URL
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
          limit: options?.limit || 100,
          offset: options?.offset || 0,
          startTime: options?.startTime,
          endTime: options?.endTime,
        },
      });

      if (error || !response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Failed to fetch metrics for component ${componentId}: ${response.status} ${response.statusText}`,
          { error: errorText },
        );
        throw new Error(
          `Failed to fetch metrics: ${response.status} ${response.statusText}`,
        );
      }

      if (httpError || !httpResponse.ok) {
        const errorText = await httpResponse.text();
        this.logger.error(
          `Failed to fetch HTTP metrics for component ${componentId}: ${httpResponse.status} ${httpResponse.statusText}`,
          { error: errorText },
        );
        throw new Error(
          `Failed to fetch HTTP metrics: ${httpResponse.status} ${httpResponse.statusText}`,
        );
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
   * @param orgName - The organization name
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
    orgName: string,
    projectName: string,
    environmentName: string,
    componentUids: string[],
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

      let observerUrl: string | undefined;

      if (environmentName) {
        const mainClient = createOpenChoreoApiClient({
          baseUrl: this.baseUrl,
          token: userToken,
          logger: this.logger,
        });
        // Get the list of components from the main API using the project
        const {
          data: componentsData,
          error: componentsError,
          response: componentsResponse,
        } = await mainClient.GET(
          '/orgs/{orgName}/projects/{projectName}/components',
          {
            params: { path: { orgName, projectName } },
          },
        );

        if (componentsError || !componentsResponse.ok) {
          throw new Error(
            `Failed to get components: ${componentsResponse.status} ${componentsResponse.statusText}`,
          );
        }

        if (
          !componentsData ||
          !componentsData.success ||
          !componentsData.data?.items
        ) {
          throw new Error(
            `API returned unsuccessful response: ${JSON.stringify(
              componentsData,
            )}`,
          );
        }

        const components = componentsData.data.items as Component[];

        if (!components || components.length === 0) {
          throw new Error(
            `No components found in project ${projectName}. Cannot get observer URL.`,
          );
        }

        const firstComponent = components[0];
        if (!firstComponent.name) {
          throw new Error(
            `Component name not found for first component in project ${projectName}`,
          );
        }

        this.logger.debug(
          `Using component ${firstComponent.name} to get observer URL for project ${projectName}`,
        );

        // Get observer URL from the main API using a component
        const {
          data: urlData,
          error: urlError,
          response: urlResponse,
        } = await mainClient.GET(
          '/orgs/{orgName}/projects/{projectName}/components/{componentName}/environments/{environmentName}/observer-url',
          {
            params: {
              path: {
                orgName,
                projectName,
                componentName: firstComponent.name,
                environmentName,
              },
            },
          },
        );

        if (urlError || !urlResponse.ok) {
          throw new Error(
            `Failed to get observer URL: ${urlResponse.status} ${urlResponse.statusText}`,
          );
        }

        if (!urlData.success || !urlData.data) {
          throw new Error(
            `API returned unsuccessful response: ${JSON.stringify(urlData)}`,
          );
        }

        observerUrl = urlData.data.observerUrl;
        if (!observerUrl) {
          throw new ObservabilityNotConfiguredError(projectName);
        }

        this.logger.debug(
          `Resolved observer URL: ${observerUrl} for project ${projectName}, environment ${environmentName}`,
        );
      } else {
        // If no environment is specified, we might need a different approach
        // For now, throw an error as we need at least environment + component to get observer URL
        throw new Error(
          'Environment and components within the project are required to fetch traces',
        );
      }

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
        const errorMessage = error
          ? JSON.stringify(error)
          : `HTTP ${response.status} ${response.statusText}`;
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

  /**
   * Fetches RCA reports for a specific project.
   * This method dynamically resolves the observability URL from the main API,
   * then fetches RCA reports from the observability service.
   *
   * @param projectId - The ID of the project
   * @param environmentId - The ID of the environment
   * @param orgName - The organization name
   * @param projectName - The project name
   * @param environmentName - The name of the environment
   * @param componentUids - Array of component UIDs to filter reports (optional)
   * @param options - Parameters for filtering reports
   * @param options.startTime - The start time of the reports (required)
   * @param options.endTime - The end time of the reports (required)
   * @param options.status - Filter by report status (pending/completed/failed) (optional)
   * @param options.limit - The maximum number of reports to return (optional)
   * @param userToken - Optional user token for authentication (takes precedence over default token)
   * @returns Promise with RCA reports data
   */
  async fetchRCAReportsByProject(
    projectId: string,
    environmentId: string,
    orgName: string,
    projectName: string,
    environmentName: string,
    componentUids: string[],
    options: {
      startTime: string;
      endTime: string;
      status?: 'pending' | 'completed' | 'failed';
      limit?: number;
    },
    userToken?: string,
  ): Promise<{
    reports: Array<{
      alertId?: string;
      projectUid?: string;
      reportId?: string;
      timestamp?: string;
      summary?: string;
      status?: 'pending' | 'completed' | 'failed';
    }>;
    totalCount?: number;
    tookMs?: number;
  }> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching RCA reports for project ${projectName} in environment ${environmentName}`,
      );

      // Resolve the observer URL using the helper function
      const observerUrl = await this.resolveObserverUrl(
        orgName,
        projectName,
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
        `Sending RCA reports request to ${observerUrl}/api/rca-reports/project/${projectId}`,
      );

      const requestBody = {
        componentUids: componentUids.length > 0 ? componentUids : undefined,
        environmentUid: environmentId,
        startTime: options.startTime,
        endTime: options.endTime,
        status: options?.status,
        limit: options?.limit || 100,
      };

      this.logger.debug(
        `Calling POST ${observerUrl}/api/rca-reports/project/${projectId} with body: ${JSON.stringify(
          requestBody,
        )}`,
      );

      const { data, error, response } = await obsClient.POST(
        '/api/rca-reports/project/{projectUid}',
        {
          params: {
            path: { projectUid: projectId },
          },
          body: requestBody,
        },
      );

      if (error || !response.ok) {
        const errorMessage = error
          ? JSON.stringify(error)
          : `HTTP ${response.status} ${response.statusText}`;
        const fullUrl = `${observerUrl}/api/rca-reports/project/${projectId}`;
        this.logger.error(
          `Failed to fetch RCA reports for project ${projectId} from ${fullUrl}: ${errorMessage}`,
        );
        throw new Error(
          `Failed to fetch RCA reports from ${fullUrl}: ${errorMessage}`,
        );
      }

      this.logger.debug(
        `Successfully fetched RCA reports for project ${projectId}: ${
          data?.reports?.length || 0
        } reports`,
      );

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `RCA reports fetch completed for project ${projectId} (${totalTime}ms)`,
      );

      return {
        reports: data?.reports || [],
        totalCount: data?.totalCount,
        tookMs: data?.tookMs,
      };
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching RCA reports for project ${projectId} (${totalTime}ms):`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Fetches a single RCA report by alert ID.
   * This method dynamically resolves the observability URL from the main API,
   * then fetches the RCA report from the observability service.
   *
   * @param alertId - The ID of the alert
   * @param projectId - The ID of the project
   * @param environmentId - The ID of the environment
   * @param orgName - The organization name
   * @param projectName - The project name
   * @param environmentName - The name of the environment
   * @param options - Optional parameters
   * @param options.version - Specific version number of the report to retrieve
   * @param userToken - Optional user token for authentication (takes precedence over default token)
   * @returns Promise with RCA report details
   */
  async fetchRCAReportByAlert(
    alertId: string,
    _projectId: string,
    _environmentId: string,
    orgName: string,
    projectName: string,
    environmentName: string,
    options?: {
      version?: number;
    },
    userToken?: string,
  ): Promise<{
    alertId?: string;
    projectUid?: string;
    reportVersion?: number;
    reportId?: string;
    timestamp?: string;
    status?: 'pending' | 'completed' | 'failed';
    availableVersions?: number[];
    [key: string]: unknown;
  }> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching RCA report for alert ${alertId} in project ${projectName}, environment ${environmentName}`,
      );

      // Resolve the observer URL using the helper function
      const observerUrl = await this.resolveObserverUrl(
        orgName,
        projectName,
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
        `Sending RCA report request to ${observerUrl}/api/rca-reports/alert/${alertId}${
          options?.version ? `?version=${options.version}` : ''
        }`,
      );

      const { data, error, response } = await obsClient.GET(
        '/api/rca-reports/alert/{alertId}',
        {
          params: {
            path: { alertId },
            query: options?.version ? { version: options.version } : {},
          },
        },
      );

      if (error || !response.ok) {
        const errorMessage = error
          ? JSON.stringify(error)
          : `HTTP ${response.status} ${response.statusText}`;
        const fullUrl = `${observerUrl}/api/rca-reports/alert/${alertId}`;
        this.logger.error(
          `Failed to fetch RCA report for alert ${alertId} from ${fullUrl}: ${errorMessage}`,
        );
        throw new Error(
          `Failed to fetch RCA report from ${fullUrl}: ${errorMessage}`,
        );
      }

      this.logger.debug(`Successfully fetched RCA report for alert ${alertId}`);

      const totalTime = Date.now() - startTime;
      this.logger.debug(
        `RCA report fetch completed for alert ${alertId} (${totalTime}ms)`,
      );

      return data || {};
    } catch (error: unknown) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error fetching RCA report for alert ${alertId} (${totalTime}ms):`,
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
