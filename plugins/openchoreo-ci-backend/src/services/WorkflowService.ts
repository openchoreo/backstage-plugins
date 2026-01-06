import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  createObservabilityClientWithUrl,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import { RuntimeLogsResponse } from '../types';

// Use generated type from OpenAPI spec
type ModelsBuild =
  OpenChoreoComponents['schemas']['ComponentWorkflowRunResponse'];

// Type definition matching the API response structure
type WorkflowSchemaResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data?: {
    [key: string]: unknown;
  };
};

type WorkflowListResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data: OpenChoreoComponents['schemas']['ListResponse'] & {
    items: OpenChoreoComponents['schemas']['WorkflowResponse'][];
  };
};

export class ObservabilityNotConfiguredError extends Error {
  constructor(componentName: string) {
    super(`Build logs are not available for component ${componentName}`);
    this.name = 'ObservabilityNotConfiguredError';
  }
}

/**
 * Service for managing component workflows and builds
 * Handles workflow schemas, build operations, and build logs
 */
export class WorkflowService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  // ==================== Build Operations ====================

  async fetchBuilds(
    orgName: string,
    projectName: string,
    componentName: string,
    token?: string,
  ): Promise<ModelsBuild[]> {
    this.logger.debug(
      `Fetching component workflow runs for component: ${componentName} in project: ${projectName}, organization: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/workflow-runs',
        {
          params: {
            path: { orgName, projectName, componentName },
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

  async getWorkflowRun(
    orgName: string,
    projectName: string,
    componentName: string,
    runName: string,
    token?: string,
  ): Promise<any> {
    this.logger.debug(
      `Fetching workflow run: ${runName} for component: ${componentName} in project: ${projectName}, organization: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/workflow-runs/{runName}',
        {
          params: {
            path: { orgName, projectName, componentName, runName },
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

  async triggerBuild(
    orgName: string,
    projectName: string,
    componentName: string,
    commit?: string,
    token?: string,
  ): Promise<ModelsBuild> {
    this.logger.info(
      `Triggering component workflow for component: ${componentName} in project: ${projectName}, organization: ${orgName}${
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
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/workflow-runs',
        {
          params: {
            path: { orgName, projectName, componentName },
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

  async fetchBuildLogs(
    orgName: string,
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
      const mainClient = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
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

  // ==================== Workflow Schema Operations ====================

  /**
   * Fetch list of component workflows for an organization
   */
  async fetchWorkflows(
    orgName: string,
    token?: string,
  ): Promise<WorkflowListResponse> {
    this.logger.debug(`Fetching component workflows for org: ${orgName}`);

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/component-workflows',
        {
          params: {
            path: { orgName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch component workflows: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('Failed to fetch component workflows');
      }

      const workflowList: WorkflowListResponse = data as WorkflowListResponse;

      this.logger.debug(
        `Successfully fetched ${workflowList.data.items.length} component workflows for org: ${orgName}`,
      );
      return workflowList;
    } catch (error) {
      this.logger.error(
        `Failed to fetch component workflows for org ${orgName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Fetch JSONSchema for a specific component workflow
   */
  async fetchWorkflowSchema(
    orgName: string,
    workflowName: string,
    token?: string,
  ): Promise<WorkflowSchemaResponse> {
    this.logger.debug(
      `Fetching schema for component workflow: ${workflowName} in org: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/component-workflows/{cwName}/schema',
        {
          params: {
            path: { orgName, cwName: workflowName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch component workflow schema: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('Failed to fetch component workflow schema');
      }

      const workflowSchema: WorkflowSchemaResponse =
        data as WorkflowSchemaResponse;

      this.logger.debug(
        `Successfully fetched schema for component workflow: ${workflowName}`,
      );
      return workflowSchema;
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for component workflow ${workflowName} in org ${orgName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Update component workflow parameters (PATCH)
   */
  async updateComponentWorkflowParameters(
    orgName: string,
    projectName: string,
    componentName: string,
    systemParameters: { [key: string]: unknown },
    parameters?: { [key: string]: unknown },
    token?: string,
  ): Promise<OpenChoreoComponents['schemas']['APIResponse']> {
    this.logger.debug(
      `Updating workflow parameters for component: ${componentName} in project: ${projectName}, org: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.PATCH(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/workflow-parameters',
        {
          params: {
            path: { orgName, projectName, componentName },
          },
          body: {
            systemParameters: systemParameters as any,
            parameters: parameters as any,
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to update workflow parameters: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('Failed to update workflow parameters');
      }

      this.logger.debug(
        `Successfully updated workflow parameters for component: ${componentName}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to update workflow parameters for component ${componentName}: ${error}`,
      );
      throw error;
    }
  }
}
