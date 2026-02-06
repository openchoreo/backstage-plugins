import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  createObservabilityClientWithUrl,
} from '@openchoreo/openchoreo-client-node';
import {
  Workflow,
  WorkflowRun,
  CreateWorkflowRunRequest,
  PaginatedResponse,
  LogsResponse,
} from '../types';

/**
 * Error thrown when observability is not configured for workflow runs
 */
export class ObservabilityNotConfiguredError extends Error {
  constructor(runName: string) {
    super(`Workflow run logs are not available for run ${runName}. Observability may not be configured.`);
    this.name = 'ObservabilityNotConfiguredError';
  }
}

/**
 * Service for managing namespace-level generic workflows
 * Handles workflow templates, runs, and schemas
 *
 * After the Organization CRD removal, the hierarchy is now:
 * Namespace → Project → Component
 */
export class GenericWorkflowService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  /**
   * List all generic workflow templates for a namespace
   */
  async listWorkflows(
    namespaceName: string,
    token?: string,
  ): Promise<PaginatedResponse<Workflow>> {
    this.logger.debug(`Fetching generic workflows for namespace: ${namespaceName}`);

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/workflows',
        {
          params: {
            path: { namespaceName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workflows: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('API request was not successful');
      }

      const items = (data.data?.items || []) as Workflow[];

      this.logger.debug(
        `Successfully fetched ${items.length} generic workflows for namespace: ${namespaceName}`,
      );

      return {
        items,
        pagination: data.data?.pagination as { nextCursor?: string } | undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch generic workflows for namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Get the JSONSchema for a workflow's parameters
   */
  async getWorkflowSchema(
    namespaceName: string,
    workflowName: string,
    token?: string,
  ): Promise<unknown> {
    this.logger.debug(
      `Fetching schema for workflow: ${workflowName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/workflows/{workflowName}/schema',
        {
          params: {
            path: { namespaceName, workflowName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workflow schema: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('API request was not successful');
      }

      this.logger.debug(
        `Successfully fetched schema for workflow: ${workflowName}`,
      );

      return data.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for workflow ${workflowName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * List workflow runs for a namespace, optionally filtered by workflow name
   * NOTE: This endpoint may not yet exist in the upstream API.
   * The workflow-runs endpoint at namespace level is pending upstream implementation.
   */
  async listWorkflowRuns(
    namespaceName: string,
    workflowName?: string,
    token?: string,
  ): Promise<PaginatedResponse<WorkflowRun>> {
    this.logger.debug(
      `Fetching workflow runs for namespace: ${namespaceName}${workflowName ? `, workflow: ${workflowName}` : ''}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // NOTE: This endpoint path assumes the upstream API will add namespace-level workflow-runs
      // If the API returns 404, the upstream may not have this endpoint yet
      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/workflow-runs' as any,
        {
          params: {
            path: { namespaceName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workflow runs: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('API request was not successful');
      }

      let items = (data.data?.items || []) as WorkflowRun[];

      // Filter by workflowName if provided (client-side filtering)
      // TODO: If upstream API supports filtering, pass workflowName as query param instead
      if (workflowName) {
        items = items.filter(run => run.workflowName === workflowName);
      }

      this.logger.debug(
        `Successfully fetched ${items.length} workflow runs for namespace: ${namespaceName}${workflowName ? `, workflow: ${workflowName}` : ''}`,
      );

      return {
        items,
        pagination: data.data?.pagination as { nextCursor?: string } | undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch workflow runs for namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Get details of a specific workflow run
   * NOTE: This endpoint may not yet exist in the upstream API.
   */
  async getWorkflowRun(
    namespaceName: string,
    runName: string,
    token?: string,
  ): Promise<WorkflowRun> {
    this.logger.debug(
      `Fetching workflow run: ${runName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // NOTE: This endpoint path assumes the upstream API will add namespace-level workflow-runs
      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/workflow-runs/{runName}' as any,
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

      if (!data?.success || !data.data) {
        throw new Error('No workflow run data returned');
      }

      this.logger.debug(`Successfully fetched workflow run: ${runName}`);

      return data.data as WorkflowRun;
    } catch (error) {
      this.logger.error(
        `Failed to fetch workflow run ${runName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Create (trigger) a new workflow run
   * NOTE: This endpoint may not yet exist in the upstream API.
   */
  async createWorkflowRun(
    namespaceName: string,
    request: CreateWorkflowRunRequest,
    token?: string,
  ): Promise<WorkflowRun> {
    this.logger.info(
      `Creating workflow run for workflow: ${request.workflowName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // NOTE: This endpoint path assumes the upstream API will add namespace-level workflow-runs
      const { data, error, response } = await client.POST(
        '/namespaces/{namespaceName}/workflow-runs' as any,
        {
          params: {
            path: { namespaceName },
          },
          body: {
            workflowName: request.workflowName,
            parameters: request.parameters,
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to create workflow run: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success || !data.data) {
        throw new Error('No workflow run data returned');
      }

      this.logger.debug(
        `Successfully created workflow run: ${data.data.name}`,
      );

      return data.data as WorkflowRun;
    } catch (error) {
      this.logger.error(
        `Failed to create workflow run for workflow ${request.workflowName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Get logs for a specific workflow run using the observability service.
   * Uses the pattern: get observer URL from environment, then fetch logs.
   *
   * @param namespaceName - The namespace name
   * @param runName - The workflow run name
   * @param environmentName - The environment name to get observer URL from (defaults to 'development')
   * @param token - Optional auth token
   */
  async getWorkflowRunLogs(
    namespaceName: string,
    runName: string,
    environmentName: string = 'development',
    token?: string,
  ): Promise<LogsResponse> {
    this.logger.debug(
      `Fetching logs for workflow run: ${runName} in namespace: ${namespaceName}`,
    );

    try {
      // First, get the workflow run to obtain its UUID
      const workflowRun = await this.getWorkflowRun(namespaceName, runName, token);
      // Use run name for observability API (not UUID)
      const runId = workflowRun.name || runName;

      // Get the observer URL from the environment
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
        '/namespaces/{namespaceName}/environments/{envName}/observer-url',
        {
          params: {
            path: {
              namespaceName,
              envName: environmentName,
            },
          },
        },
      );

      if (urlError || !urlResponse.ok) {
        if (urlResponse.status === 404) {
          throw new ObservabilityNotConfiguredError(runName);
        }
        throw new Error(
          `Failed to get observer URL: ${urlResponse.status} ${urlResponse.statusText}`,
        );
      }

      if (!urlData || !urlData.success || !urlData.data) {
        throw new Error(
          `API returned unsuccessful response: ${JSON.stringify(urlData)}`,
        );
      }

      const observerUrl = urlData.data?.observerUrl;
      if (!observerUrl) {
        throw new ObservabilityNotConfiguredError(runName);
      }

      // Now use the observability client with the resolved URL
      const obsClient = createObservabilityClientWithUrl(
        observerUrl,
        token,
        this.logger,
      );

      this.logger.debug(
        `Sending workflow run logs request for run ${runName} with id: ${runId}`,
      );

      // Call the observability service to get workflow run logs
      // Wrap in try-catch to handle cases where endpoint doesn't exist
      let data: any;
      let response: Response;

      // Calculate timestamps for the request
      const startTime = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(); // 30 days ago
      const endTime = new Date().toISOString();

      this.logger.info(
        `Workflow run logs request timestamps - startTime: ${startTime}, endTime: ${endTime}, runId: ${runId}`,
      );

      try {
        const result = await obsClient.POST(
          '/api/v1/workflow-runs/{runId}/logs' as any,
          {
            params: {
              path: { runId },
            },
            body: {
              startTime,
              endTime,
              limit: 1000,
              sortOrder: 'asc',
              namespaceName,
            },
          },
        );
        data = result.data;
        response = result.response;

        if (result.error || !response.ok) {
          // If endpoint doesn't exist (404), treat as not configured
          if (response.status === 404) {
            this.logger.info(
              `Workflow run logs endpoint not available (404). The observability service may not support workflow run logs yet.`,
            );
            throw new ObservabilityNotConfiguredError(runName);
          }
          this.logger.error(
            `Failed to fetch workflow run logs for ${runName}: ${response.status} ${response.statusText}`,
            { error: result.error ? JSON.stringify(result.error) : 'Unknown error' },
          );
          throw new Error(
            `Failed to fetch workflow run logs: ${response.status} ${response.statusText}`,
          );
        }
      } catch (obsError: unknown) {
        // If it's already our error type, rethrow
        if (obsError instanceof ObservabilityNotConfiguredError) {
          throw obsError;
        }
        // For any other error (connection refused, endpoint not found, etc.)
        // treat as observability not configured
        this.logger.info(
          `Could not fetch workflow run logs: ${obsError}. The observability service may not support workflow run logs yet.`,
        );
        throw new ObservabilityNotConfiguredError(runName);
      }

      this.logger.debug(
        `Successfully fetched ${data?.logs?.length || 0} log entries for workflow run: ${runName}`,
      );

      return {
        logs: data?.logs || [],
        totalCount: data?.totalCount || 0,
        tookMs: data?.tookMs || 0,
      };
    } catch (error: unknown) {
      if (error instanceof ObservabilityNotConfiguredError) {
        this.logger.info(
          `Observability not configured for workflow run ${runName}`,
        );
        throw error;
      }

      this.logger.error(
        `Error fetching logs for workflow run ${runName} in namespace ${namespaceName}:`,
        error as Error,
      );
      throw error;
    }
  }
}
