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
import { Environment, ResourceMetricsTimeSeries } from '../types';

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
  private readonly token?: string;

  static create(
    logger: LoggerService,
    baseUrl: string,
    token?: string,
  ): ObservabilityService {
    return new ObservabilityService(logger, baseUrl, token);
  }

  private constructor(logger: LoggerService, baseUrl: string, token?: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.token = token;
  }

  /**
   * Fetches environments for observability filtering purposes.
   */
  async fetchEnvironmentsByOrganization(
    organizationName: string,
  ): Promise<Environment[]> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Starting environment fetch for organization: ${organizationName}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
        token: this.token,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/environments',
        {
          params: {
            path: { orgName: organizationName },
          },
        },
      );

      if (error || !response.ok) {
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
   * @param environmentId - The ID of the environment
   * @param projectId - The ID of the project
   * @param orgName - The organization name
   * @param projectName - The project name
   * @param environmentName - The name of the environment
   * @param componentName - The name of the component
   * @param options - Optional parameters for filtering metrics
   * @param options.limit - The maximum number of metrics to return
   * @param options.offset - The offset from the first metric to return
   * @param options.startTime - The start time of the metrics
   * @param options.endTime - The end time of the metrics
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
  ): Promise<ResourceMetricsTimeSeries> {
    const startTime = Date.now();
    try {
      this.logger.debug(
        `Fetching metrics for component ${componentName} in environment ${environmentName}`,
      );

      // First, get the observer URL from the main API
      const mainClient = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: this.token,
        logger: this.logger,
      });
      const {
        data: urlData,
        error: urlError,
        response: urlResponse,
      } = await mainClient.GET(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/environments/{environmentName}/observer-url' as any,
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
        this.token,
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
        const token = deps.config.getOptionalString('openchoreo.token');

        return ObservabilityService.create(deps.logger, baseUrl, token);
      },
    }),
});
