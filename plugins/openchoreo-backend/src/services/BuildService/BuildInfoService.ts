import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  createObservabilityClientWithUrl,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import { RuntimeLogsResponse } from '../../types';

// Use generated type from OpenAPI spec
type ModelsBuild = OpenChoreoComponents['schemas']['Build'];

export class ObservabilityNotConfiguredError extends Error {
  constructor(componentName: string) {
    super(`Build logs are not available for component ${componentName}`);
    this.name = 'ObservabilityNotConfiguredError';
  }
}

export class BuildInfoService {
  private logger: LoggerService;
  private baseUrl: string;
  private token?: string;

  constructor(logger: LoggerService, baseUrl: string, token?: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async fetchBuilds(
    orgName: string,
    projectName: string,
    componentName: string,
  ): Promise<ModelsBuild[]> {
    this.logger.debug(
      `Fetching builds for component: ${componentName} in project: ${projectName}, organization: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/builds',
        {
          params: {
            path: { orgName, projectName, componentName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch builds: ${response.status} ${response.statusText}`,
        );
      }

      if (!data.success) {
        throw new Error('API request was not successful');
      }

      const builds = data.data?.items || [];

      this.logger.debug(
        `Successfully fetched ${builds.length} builds for component: ${componentName}`,
      );
      return builds;
    } catch (error) {
      this.logger.error(
        `Failed to fetch builds for component ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  async triggerBuild(
    orgName: string,
    projectName: string,
    componentName: string,
    commit?: string,
  ): Promise<ModelsBuild> {
    this.logger.info(
      `Triggering build for component: ${componentName} in project: ${projectName}, organization: ${orgName}${
        commit ? ` with commit: ${commit}` : ''
      }`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
      });

      const { data, error, response } = await client.POST(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/builds',
        {
          params: {
            path: { orgName, projectName, componentName },
            query: commit ? { commit } : undefined,
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to trigger build: ${response.status} ${response.statusText}`,
        );
      }

      if (!data.success || !data.data) {
        throw new Error('No build data returned');
      }

      this.logger.debug(
        `Successfully triggered build for component: ${componentName}, build name: ${data.data.name}`,
      );
      return data.data;
    } catch (error) {
      this.logger.error(
        `Failed to trigger build for component ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  async fetchBuildLogs(
    orgName: string,
    projectName: string,
    componentName: string,
    buildId: string,
    buildUuid: string,
    searchPhrase?: string,
    limit?: number,
    sortOrder?: 'asc' | 'desc',
  ): Promise<RuntimeLogsResponse> {
    this.logger.debug(
      `Fetching build logs for component: ${componentName}, build: ${buildId}`,
    );

    try {
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
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/observer-url',
        {
          params: {
            path: {
              orgName,
              projectName,
              componentName,
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
        throw new ObservabilityNotConfiguredError(componentName);
      }

      // Now use the observability client with the resolved URL
      const obsClient = createObservabilityClientWithUrl(
        observerUrl,
        this.token,
        this.logger,
      );

      this.logger.debug(
        `Sending build logs request for component ${componentName} with build: ${buildId}`,
      );

      const { data, error, response } = await obsClient.POST(
        '/api/logs/component/{componentId}',
        {
          params: {
            path: { componentId: componentName },
          },
          body: {
            startTime: new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000,
            ).toISOString(), // 30 days ago
            endTime: new Date().toISOString(),
            environmentId: 'default',
            namespace: 'default',
            limit: limit || 100,
            sortOrder: sortOrder || 'desc',
            logType: 'build',
            buildId,
            buildUuid,
            ...(searchPhrase && { searchPhrase }),
          },
        },
      );

      if (error || !response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Failed to fetch build logs for component ${componentName}: ${response.status} ${response.statusText}`,
          { error: errorText },
        );
        throw new Error(
          `Failed to fetch build logs: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.debug(
        `Successfully fetched ${
          data.logs?.length || 0
        } build logs for component ${componentName}`,
      );

      return {
        logs: data.logs || [],
        totalCount: data.totalCount || 0,
        tookMs: data.tookMs || 0,
      };
    } catch (error: unknown) {
      if (error instanceof ObservabilityNotConfiguredError) {
        this.logger.info(
          `Observability not configured for component ${componentName}`,
        );
        throw error;
      }

      this.logger.error(
        `Error fetching build logs for component ${componentName}:`,
        error as Error,
      );
      throw error;
    }
  }
}
