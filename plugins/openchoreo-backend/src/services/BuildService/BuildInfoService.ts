import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoLegacyApiClient,
  createOpenChoreoApiClient,
  createObservabilityClientWithUrl,
  fetchAllPages,
  type OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';
import { transformComponentWorkflowRun } from '../transformers';
import { RuntimeLogsResponse } from '../../types';

// Use generated type from OpenAPI spec
type ModelsBuild =
  OpenChoreoLegacyComponents['schemas']['ComponentWorkflowRunResponse'];

export class ObservabilityNotConfiguredError extends Error {
  constructor(componentName: string) {
    super(`Build logs are not available for component ${componentName}`);
    this.name = 'ObservabilityNotConfiguredError';
  }
}

export class BuildInfoService {
  private logger: LoggerService;
  private baseUrl: string;
  private useNewApi: boolean;

  constructor(logger: LoggerService, baseUrl: string, useNewApi = false) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.useNewApi = useNewApi;
  }

  async fetchBuilds(
    namespaceName: string,
    projectName: string,
    componentName: string,
    token?: string,
  ): Promise<ModelsBuild[]> {
    if (this.useNewApi) {
      return this.fetchBuildsNew(namespaceName, componentName, token);
    }
    return this.fetchBuildsLegacy(
      namespaceName,
      projectName,
      componentName,
      token,
    );
  }

  private async fetchBuildsLegacy(
    namespaceName: string,
    projectName: string,
    componentName: string,
    token?: string,
  ): Promise<ModelsBuild[]> {
    this.logger.debug(
      `Fetching component workflow runs for component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/workflow-runs',
        {
          params: {
            path: { namespaceName, projectName, componentName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch component workflow runs: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('API request was not successful');
      }

      const builds = (data.data?.items || []) as any;

      this.logger.debug(
        `Successfully fetched ${builds.length} component workflow runs for component: ${componentName}`,
      );
      return builds;
    } catch (error) {
      this.logger.error(
        `Failed to fetch component workflow runs for component ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  private async fetchBuildsNew(
    namespaceName: string,
    componentName: string,
    token?: string,
  ): Promise<ModelsBuild[]> {
    this.logger.debug(
      `Fetching component workflow runs (new API) for component: ${componentName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const items = await fetchAllPages(cursor =>
        client
          .GET('/api/v1/namespaces/{namespaceName}/component-workflow-runs', {
            params: {
              path: { namespaceName },
              query: { component: componentName, limit: 100, cursor },
            },
          })
          .then(res => {
            if (res.error || !res.response.ok) {
              throw new Error(
                `Failed to fetch component workflow runs: ${res.response.status} ${res.response.statusText}`,
              );
            }
            return res.data;
          }),
      );

      const builds = items.map(transformComponentWorkflowRun);

      this.logger.debug(
        `Successfully fetched ${builds.length} component workflow runs for component: ${componentName}`,
      );
      return builds;
    } catch (error) {
      this.logger.error(
        `Failed to fetch component workflow runs for component ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  async getWorkflowRun(
    namespaceName: string,
    projectName: string,
    componentName: string,
    runName: string,
    token?: string,
  ): Promise<any> {
    if (this.useNewApi) {
      return this.getWorkflowRunNew(namespaceName, runName, token);
    }
    return this.getWorkflowRunLegacy(
      namespaceName,
      projectName,
      componentName,
      runName,
      token,
    );
  }

  private async getWorkflowRunLegacy(
    namespaceName: string,
    projectName: string,
    componentName: string,
    runName: string,
    token?: string,
  ): Promise<any> {
    this.logger.debug(
      `Fetching workflow run: ${runName} for component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/workflow-runs/{runName}',
        {
          params: {
            path: { namespaceName, projectName, componentName, runName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workflow run: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success || !data.data) {
        throw new Error('No workflow run data returned');
      }

      this.logger.debug(`Successfully fetched workflow run: ${runName}`);
      return data.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch workflow run ${runName} for component ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  private async getWorkflowRunNew(
    namespaceName: string,
    runName: string,
    token?: string,
  ): Promise<any> {
    this.logger.debug(
      `Fetching workflow run (new API): ${runName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/component-workflow-runs/{runName}',
        {
          params: {
            path: { namespaceName, runName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workflow run: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.debug(`Successfully fetched workflow run: ${runName}`);
      return transformComponentWorkflowRun(data);
    } catch (error) {
      this.logger.error(`Failed to fetch workflow run ${runName}: ${error}`);
      throw error;
    }
  }

  async triggerBuild(
    namespaceName: string,
    projectName: string,
    componentName: string,
    commit?: string,
    token?: string,
  ): Promise<ModelsBuild> {
    if (this.useNewApi) {
      return this.triggerBuildNew(namespaceName, componentName, commit, token);
    }
    return this.triggerBuildLegacy(
      namespaceName,
      projectName,
      componentName,
      commit,
      token,
    );
  }

  private async triggerBuildLegacy(
    namespaceName: string,
    projectName: string,
    componentName: string,
    commit?: string,
    token?: string,
  ): Promise<ModelsBuild> {
    this.logger.info(
      `Triggering component workflow for component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}${
        commit ? ` with commit: ${commit}` : ''
      }`,
    );

    try {
      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.POST(
        '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/workflow-runs',
        {
          params: {
            path: { namespaceName, projectName, componentName },
            query: commit ? { commit } : undefined,
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to create component workflow run: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success || !data.data) {
        throw new Error('No workflow run data returned');
      }

      this.logger.debug(
        `Successfully triggered component workflow for component: ${componentName}, workflow run name: ${data.data.name}`,
      );
      return data.data as any;
    } catch (error) {
      this.logger.error(
        `Failed to trigger component workflow for component ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  private async triggerBuildNew(
    namespaceName: string,
    componentName: string,
    commit?: string,
    token?: string,
  ): Promise<ModelsBuild> {
    this.logger.info(
      `Triggering component workflow (new API) for component: ${componentName} in namespace: ${namespaceName}${
        commit ? ` with commit: ${commit}` : ''
      }`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.POST(
        '/api/v1/namespaces/{namespaceName}/component-workflow-runs',
        {
          params: {
            path: { namespaceName },
            query: commit ? { commit } : undefined,
          },
          body: {
            spec: {
              owner: { componentName },
            },
          } as any,
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to create component workflow run: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.debug(
        `Successfully triggered component workflow for component: ${componentName}`,
      );
      return transformComponentWorkflowRun(data);
    } catch (error) {
      this.logger.error(
        `Failed to trigger component workflow for component ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  async fetchBuildLogs(
    namespaceName: string,
    projectName: string,
    componentName: string,
    buildId: string,
    limit?: number,
    sortOrder?: 'asc' | 'desc',
    token?: string,
  ): Promise<RuntimeLogsResponse> {
    this.logger.debug(
      `Fetching build logs for component: ${componentName}, build: ${buildId}`,
    );

    try {
      // First, get the observer URL from the main API
      const mainClient = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const {
        data: urlData,
        error: urlError,
        response: urlResponse,
      } = await mainClient.GET(
        '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/observer-url',
        {
          params: {
            path: {
              namespaceName,
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
        token,
        this.logger,
      );

      this.logger.debug(
        `Sending build logs request for component ${componentName} with build: ${buildId}`,
      );

      const { data, error, response } = await obsClient.POST(
        '/api/logs/build/{buildId}',
        {
          params: {
            path: { buildId },
          },
          body: {
            startTime: new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000,
            ).toISOString(), // 30 days ago
            endTime: new Date().toISOString(),
            limit: limit || 1000, // Default to 1000 until pagination is implemented
            sortOrder: sortOrder || 'asc',
            componentName,
            projectName,
            namespaceName,
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
