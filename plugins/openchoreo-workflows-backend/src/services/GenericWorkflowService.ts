import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  createObservabilityClientWithUrl,
  assertApiResponse,
  ObservabilityUrlResolver,
} from '@openchoreo/openchoreo-client-node';
import { CHOREO_LABELS } from '@openchoreo/backstage-plugin-common';
import {
  Workflow,
  WorkflowRun,
  CreateWorkflowRunRequest,
  PaginatedResponse,
  LogsResponse,
  WorkflowRunStatusResponse,
  WorkflowRunEventEntry,
} from '../types';

/**
 * Derive a display status from a raw K8s-style WorkflowRun object.
 *
 * Checks conditions in priority order, matching the Go-side
 * getComponentWorkflowStatus logic:
 *   1. WorkloadUpdated + True → Completed
 *   2. WorkflowFailed  + True → Failed
 *   3. WorkflowSucceeded + True → Succeeded
 *   4. WorkflowRunning + True → Running
 *   5. Default → Pending
 */
function deriveWorkflowRunStatus(run: any): string {
  const conditions = (run.status?.conditions ?? []) as any[];

  if (conditions.length === 0) {
    return 'Pending';
  }

  if (
    conditions.some(c => c.type === 'WorkloadUpdated' && c.status === 'True')
  ) {
    return 'Completed';
  }

  if (
    conditions.some(c => c.type === 'WorkflowFailed' && c.status === 'True')
  ) {
    return 'Failed';
  }

  if (
    conditions.some(c => c.type === 'WorkflowSucceeded' && c.status === 'True')
  ) {
    return 'Succeeded';
  }

  if (
    conditions.some(c => c.type === 'WorkflowRunning' && c.status === 'True')
  ) {
    return 'Running';
  }

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
 * Service for managing namespace-level generic workflows
 * Handles workflow templates, runs, and schemas
 *
 * After the Organization CRD removal, the hierarchy is now:
 * Namespace → Project → Component
 */
const TERMINAL_STATUSES = new Set(['Completed', 'Failed', 'Succeeded']);

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

      assertApiResponse({ data, error, response }, 'fetch workflows');

      // Map K8s-style Workflow to the local flat Workflow interface
      const items: Workflow[] = ((data as any)?.items || []).map((wf: any) => {
        const name: string = wf.metadata?.name ?? '';
        const isCI =
          wf.metadata?.labels?.[CHOREO_LABELS.WORKFLOW_TYPE] === 'component';
        return {
          name,
          displayName:
            wf.metadata?.annotations?.['openchoreo.dev/display-name'] ?? name,
          description: wf.metadata?.annotations?.['openchoreo.dev/description'],
          createdAt: wf.metadata?.creationTimestamp,
          type: isCI ? 'CI' : 'Generic',
        };
      });

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

      assertApiResponse({ data, error, response }, 'fetch workflow schema');

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
   * Get the JSONSchema for a cluster-scoped workflow's parameters
   */
  async getClusterWorkflowSchema(
    clusterWorkflowName: string,
    token?: string,
  ): Promise<unknown> {
    this.logger.debug(
      `Fetching schema for cluster workflow: ${clusterWorkflowName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/clusterworkflows/{clusterWorkflowName}/schema' as any,
        {
          params: {
            path: { clusterWorkflowName },
          },
        } as any,
      );

      assertApiResponse(
        { data, error, response },
        'fetch cluster workflow schema',
      );

      this.logger.debug(
        `Successfully fetched schema for cluster workflow: ${clusterWorkflowName}`,
      );

      return data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for cluster workflow ${clusterWorkflowName}: ${error}`,
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
    projectName?: string,
    componentName?: string,
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

      assertApiResponse({ data, error, response }, 'fetch workflow runs');

      const rawItems = ((data as any)?.items || []) as any[];

      // Filter by workflowName before transforming (check both flat and K8s fields)
      // TODO: If upstream API supports filtering, pass workflowName as query param instead
      let filtered = workflowName
        ? rawItems.filter(
            run =>
              run.spec?.workflow?.name === workflowName ||
              run.workflowName === workflowName,
          )
        : rawItems;

      // Filter by project and component labels if provided
      if (projectName) {
        filtered = filtered.filter(
          run =>
            run.metadata?.labels?.[CHOREO_LABELS.WORKFLOW_PROJECT] ===
            projectName,
        );
      }
      if (componentName) {
        filtered = filtered.filter(
          run =>
            run.metadata?.labels?.[CHOREO_LABELS.WORKFLOW_COMPONENT] ===
            componentName,
        );
      }

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
   * List OpenChoreo namespaces (those labeled openchoreo.dev/namespace=true).
   * Used to populate the namespace selector on the ClusterWorkflow runs page.
   */
  async listNamespaces(token?: string): Promise<string[]> {
    this.logger.debug('Fetching OpenChoreo namespaces');

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET('/api/v1/namespaces');

      assertApiResponse({ data, error, response }, 'fetch namespaces');

      const names: string[] = ((data as any)?.items || [])
        .map((ns: any) => ns.metadata?.name ?? '')
        .filter(Boolean);

      this.logger.debug(`Successfully fetched ${names.length} namespaces`);

      return names;
    } catch (error) {
      this.logger.error(`Failed to fetch namespaces: ${error}`);
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

      assertApiResponse({ data, error, response }, 'fetch workflow run');

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
            metadata: {
              name:
                request.workflowRunName?.trim() ||
                `${request.workflowName}-${Date.now()}`,
              ...(request.labels && { labels: request.labels }),
              ...(request.annotations && { annotations: request.annotations }),
            },
            spec: {
              workflow: {
                kind: request.workflowKind,
                name: request.workflowName,
                parameters: request.parameters,
              },
            },
          } as any,
        },
      );

      assertApiResponse({ data, error, response }, 'create workflow run');

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
   * Get logs for a specific workflow run.
   */
  async getWorkflowRunLogs(
    namespaceName: string,
    runName: string,
    task?: string,
    token?: string,
  ): Promise<LogsResponse> {
    this.logger.debug(
      `Fetching logs for workflow run: ${runName} in namespace: ${namespaceName}${
        task ? `, task: ${task}` : ''
      }`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/workflowruns/{runName}/logs',
        {
          params: {
            path: { namespaceName, runName },
            query: { ...(task ? { task } : {}) },
          },
        },
      );

      if (!error && response.ok && Array.isArray(data) && data.length > 0) {
        const logs = data.map((entry: any) => ({
          timestamp: entry.timestamp ?? '',
          log: entry.log,
        }));
        this.logger.debug(
          `Fetched ${logs.length} live log entries for run: ${runName}`,
        );
        return { logs, totalCount: logs.length };
      }

      const {
        data: runData,
        error: runError,
        response: runResponse,
      } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/workflowruns/{runName}',
        { params: { path: { namespaceName, runName } } },
      );

      if (runError || !runResponse.ok || !runData) {
        return { logs: [], totalCount: 0 };
      }

      const runStatus = deriveWorkflowRunStatus(runData);
      if (!TERMINAL_STATUSES.has(runStatus)) {
        return { logs: [], totalCount: 0 };
      }

      let observerUrl: string | undefined;
      const projectName = (runData as any).metadata?.labels?.[
        CHOREO_LABELS.WORKFLOW_PROJECT
      ];
      try {
        if (projectName) {
          ({ observerUrl } = await this.resolver.resolveForBuild(
            namespaceName,
            projectName,
            token,
          ));
        } else {
          ({ observerUrl } = await this.resolver.resolveForEnvironment(
            namespaceName,
            'development',
            token,
          ));
        }
      } catch (resolveErr) {
        this.logger.debug(
          `Could not resolve observer URL for run ${runName}: ${resolveErr}`,
        );
        return { logs: [], totalCount: 0 };
      }

      if (!observerUrl) {
        return { logs: [], totalCount: 0 };
      }

      const obsClient = createObservabilityClientWithUrl(
        observerUrl,
        token,
        this.logger,
      );
      const startTime = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const endTime = new Date().toISOString();

      this.logger.debug(
        `Querying observer logs for run ${runName}, namespace: ${namespaceName}`,
      );

      const {
        data: obsData,
        error: obsError,
        response: obsResponse,
      } = await obsClient.POST('/api/v1/logs/query', {
        body: {
          startTime,
          endTime,
          limit: 1000,
          sortOrder: 'asc',
          searchScope: {
            namespace: namespaceName,
            workflowRunName: runName,
            ...(task ? { taskName: task } : {}),
          },
        },
      });

      if (obsError || !obsResponse.ok) {
        this.logger.error(
          `Failed to fetch observer logs for run ${runName}: ${obsResponse.status} ${obsResponse.statusText}`,
        );
        return { logs: [], totalCount: 0 };
      }

      const obsLogs = ((obsData?.logs || []) as any[]).map((entry: any) => ({
        timestamp: entry.timestamp ?? '',
        log: entry.log,
      }));

      this.logger.debug(
        `Observer fetched ${obsLogs.length} log entries for run: ${runName}`,
      );

      return {
        logs: obsLogs,
        totalCount: obsData?.total ?? obsLogs.length,
        tookMs: obsData?.tookMs,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Error fetching logs for workflow run ${runName} in namespace ${namespaceName}:`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Get status (including steps) for a specific workflow run
   */
  async getWorkflowRunStatus(
    namespaceName: string,
    runName: string,
    token?: string,
  ): Promise<WorkflowRunStatusResponse> {
    this.logger.debug(
      `Fetching status for workflow run: ${runName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/workflowruns/{runName}/status',
        {
          params: {
            path: { namespaceName, runName },
          },
        },
      );

      assertApiResponse({ data, error, response }, 'fetch workflow run status');

      this.logger.debug(
        `Successfully fetched status for workflow run: ${runName}`,
      );

      return data as WorkflowRunStatusResponse;
    } catch (error) {
      this.logger.error(
        `Failed to fetch status for workflow run ${runName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Get Kubernetes events for a specific workflow run (optionally filtered by task)
   */
  async getWorkflowRunEvents(
    namespaceName: string,
    runName: string,
    task?: string,
    token?: string,
  ): Promise<WorkflowRunEventEntry[]> {
    this.logger.debug(
      `Fetching events for workflow run: ${runName} in namespace: ${namespaceName}${
        task ? `, task: ${task}` : ''
      }`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/workflowruns/{runName}/events',
        {
          params: {
            path: { namespaceName, runName },
            query: {
              ...(task ? { task } : {}),
            },
          },
        },
      );

      assertApiResponse({ data, error, response }, 'fetch workflow run events');

      if (!Array.isArray(data)) {
        return [];
      }

      const entries: WorkflowRunEventEntry[] = data.map((entry: any) => ({
        timestamp: entry.timestamp,
        type: entry.type,
        reason: entry.reason,
        message: entry.message,
      }));

      this.logger.debug(
        `Successfully fetched ${entries.length} events for workflow run: ${runName}`,
      );

      return entries;
    } catch (error) {
      this.logger.error(
        `Failed to fetch events for workflow run ${runName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }
}
