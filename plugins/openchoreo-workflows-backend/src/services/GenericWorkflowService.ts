import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  createObservabilityClientWithUrl,
  ObservabilityUrlResolver,
} from '@openchoreo/openchoreo-client-node';
import {
  Workflow,
  WorkflowRun,
  CreateWorkflowRunRequest,
  PaginatedResponse,
  LogsResponse,
} from '../types';

/**
 * Derive a string status from a raw K8s-style WorkflowRun object.
 *
 * completedAt is treated as the strongest signal: if set, the run is
 * definitively done and we never return an in-progress status, even if
 * the K8s conditions are stale (e.g. controller hasn't reconciled yet).
 */
function deriveWorkflowRunStatus(run: any): string {
  const conditions = (run.status?.conditions ?? []) as any[];
  const readyCondition = conditions.find(c => c.type === 'Ready');
  const tasks = (run.status?.tasks ?? []) as any[];

  // completedAt is the strongest completion signal — takes priority
  if (run.status?.completedAt) {
    if (tasks.some((t: any) => t.phase === 'Failed' || t.phase === 'Error')) {
      return 'Failed';
    }
    // Use condition reason only if it is a terminal (non-in-progress) state
    const reason = readyCondition?.reason;
    if (reason && reason !== 'Running' && reason !== 'Pending') {
      return reason;
    }
    return 'Succeeded';
  }

  // Trust the Ready condition when the run has not yet completed
  if (readyCondition) {
    return (
      readyCondition.reason ||
      (readyCondition.status === 'True' ? 'Succeeded' : 'Running')
    );
  }

  // No conditions — fall back to tasks then timing
  if (tasks.some((t: any) => t.phase === 'Failed' || t.phase === 'Error')) {
    return 'Failed';
  }
  if (tasks.every((t: any) => t.phase === 'Succeeded') && tasks.length > 0) {
    return 'Succeeded';
  }
  if (tasks.some((t: any) => t.phase === 'Running')) {
    return 'Running';
  }
  if (run.status?.startedAt) return 'Running';
  return 'Pending';
}

/**
 * Transform a raw K8s WorkflowRun object into the local flat WorkflowRun shape.
 */
function transformWorkflowRun(run: any): import('../types').WorkflowRun {
  return {
    name: run.metadata?.name ?? '',
    uuid: run.metadata?.uid,
    workflowName: run.spec?.workflow?.name ?? '',
    namespaceName: run.metadata?.namespace ?? '',
    status: deriveWorkflowRunStatus(run),
    parameters: run.spec?.workflow?.parameters,
    createdAt: run.metadata?.creationTimestamp,
    finishedAt: run.status?.completedAt,
  };
}

/**
 * Error thrown when observability is not configured for workflow runs
 */
export class ObservabilityNotConfiguredError extends Error {
  constructor(runName: string) {
    super(
      `Workflow run logs are not available for run ${runName}. Observability may not be configured.`,
    );
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
  private readonly resolver: ObservabilityUrlResolver;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.resolver = new ObservabilityUrlResolver({ baseUrl, logger });
  }

  /**
   * List all generic workflow templates for a namespace
   */
  async listWorkflows(
    namespaceName: string,
    token?: string,
  ): Promise<PaginatedResponse<Workflow>> {
    this.logger.debug(
      `Fetching generic workflows for namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/workflows',
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

      // Map K8s-style Workflow to the local flat Workflow interface
      const items: Workflow[] = ((data as any)?.items || []).map((wf: any) => ({
        name: wf.metadata?.name ?? '',
        displayName:
          wf.metadata?.annotations?.['openchoreo.dev/display-name'] ??
          wf.metadata?.name,
        description: wf.metadata?.annotations?.['openchoreo.dev/description'],
        createdAt: wf.metadata?.creationTimestamp,
      }));

      this.logger.debug(
        `Successfully fetched ${items.length} generic workflows for namespace: ${namespaceName}`,
      );

      return {
        items,
        pagination: (data as any)?.pagination as
          | { nextCursor?: string }
          | undefined,
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
        '/api/v1/namespaces/{namespaceName}/workflows/{workflowName}/schema',
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

      this.logger.debug(
        `Successfully fetched schema for workflow: ${workflowName}`,
      );

      return data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for workflow ${workflowName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * List workflow runs for a namespace, optionally filtered by workflow name
   */
  async listWorkflowRuns(
    namespaceName: string,
    workflowName?: string,
    token?: string,
  ): Promise<PaginatedResponse<WorkflowRun>> {
    this.logger.debug(
      `Fetching workflow runs for namespace: ${namespaceName}${
        workflowName ? `, workflow: ${workflowName}` : ''
      }`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/workflowruns',
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

      const rawItems = ((data as any)?.items || []) as any[];

      // Filter by workflowName before transforming (check both flat and K8s fields)
      // TODO: If upstream API supports filtering, pass workflowName as query param instead
      const filtered = workflowName
        ? rawItems.filter(
            run =>
              run.spec?.workflow?.name === workflowName ||
              run.workflowName === workflowName,
          )
        : rawItems;

      const items: WorkflowRun[] = filtered.map(transformWorkflowRun);

      this.logger.debug(
        `Successfully fetched ${
          items.length
        } workflow runs for namespace: ${namespaceName}${
          workflowName ? `, workflow: ${workflowName}` : ''
        }`,
      );

      return {
        items,
        pagination: (data as any)?.pagination as
          | { nextCursor?: string }
          | undefined,
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

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/workflowruns/{runName}',
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

      if (!data) {
        throw new Error('No workflow run data returned');
      }

      this.logger.debug(`Successfully fetched workflow run: ${runName}`);

      return transformWorkflowRun(data);
    } catch (error) {
      this.logger.error(
        `Failed to fetch workflow run ${runName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Create (trigger) a new workflow run
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

      const { data, error, response } = await client.POST(
        '/api/v1/namespaces/{namespaceName}/workflowruns',
        {
          params: {
            path: { namespaceName },
          },
          body: {
            metadata: { name: `${request.workflowName}-${Date.now()}` },
            spec: {
              workflow: {
                name: request.workflowName,
                parameters: request.parameters,
              },
            },
          } as any,
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to create workflow run: ${response.status} ${response.statusText}`,
        );
      }

      if (!data) {
        throw new Error('No workflow run data returned');
      }

      this.logger.debug(
        `Successfully created workflow run: ${(data as any).metadata?.name}`,
      );

      return transformWorkflowRun(data);
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
      const workflowRun = await this.getWorkflowRun(
        namespaceName,
        runName,
        token,
      );
      // Use run name for observability API (not UUID)
      const runId = (workflowRun as any).metadata?.name || runName;

      // Resolve the observer URL via the reference chain
      const { observerUrl } = await this.resolver.resolveForEnvironment(
        namespaceName,
        environmentName,
        token,
      );

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
            {
              error: result.error
                ? JSON.stringify(result.error)
                : 'Unknown error',
            },
          );
          throw new Error(
            `Failed to fetch workflow run logs: ${response.status} ${response.statusText}`,
          );
        }
      } catch (obsError: unknown) {
        if (obsError instanceof ObservabilityNotConfiguredError) {
          throw obsError;
        }
        // Only treat connection-refused/fetch-failed errors as "not configured"
        const message =
          obsError instanceof Error ? obsError.message : String(obsError);
        if (
          message.includes('ECONNREFUSED') ||
          message.includes('fetch failed')
        ) {
          this.logger.info(
            `Could not reach observability service: ${message}. Treating as not configured.`,
          );
          throw new ObservabilityNotConfiguredError(runName);
        }
        throw obsError;
      }

      this.logger.debug(
        `Successfully fetched ${
          data?.logs?.length || 0
        } log entries for workflow run: ${runName}`,
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
