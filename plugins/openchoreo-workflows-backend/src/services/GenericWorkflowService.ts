import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  createObservabilityClientWithUrl,
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

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workflows: ${response.status} ${response.statusText}`,
        );
      }

      // Map K8s-style Workflow to the local flat Workflow interface
      const items: Workflow[] = ((data as any)?.items || []).map((wf: any) => {
        const name: string = wf.metadata?.name ?? '';
        const isCI =
          wf.metadata?.annotations?.['openchoreo.dev/workflow-scope'] ===
          'component';
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

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workflow runs: ${response.status} ${response.statusText}`,
        );
      }

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
            metadata: {
              name:
                request.workflowRunName?.trim() ||
                `${request.workflowName}-${Date.now()}`,
              ...(request.labels && { labels: request.labels }),
              ...(request.annotations && { annotations: request.annotations }),
            },
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

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workflow run status: ${response.status} ${response.statusText}`,
        );
      }

      if (!data) {
        throw new Error('No workflow run status data returned');
      }

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

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workflow run events: ${response.status} ${response.statusText}`,
        );
      }

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

      if (entries.length === 0) {
        const observerResult = await this.fetchEventsFromObserver(
          namespaceName,
          runName,
          task,
          token,
        );
        if (observerResult !== null) return observerResult;
      }

      return entries;
    } catch (error) {
      this.logger.error(
        `Failed to fetch events for workflow run ${runName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Fallback: fetch events from the observer (OpenSearch) API for completed CI workflow runs.
   * Returns null if the run is not a terminal CI run or if the observer is unavailable.
   */
  private async fetchEventsFromObserver(
    namespaceName: string,
    runName: string,
    task?: string,
    token?: string,
  ): Promise<WorkflowRunEventEntry[] | null> {
    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const {
        data: run,
        error,
        response,
      } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/workflowruns/{runName}',
        { params: { path: { namespaceName, runName } } },
      );

      if (error || !response.ok || !run) return null;

      const runStatus = deriveWorkflowRunStatus(run);
      if (!TERMINAL_STATUSES.has(runStatus)) return null;

      const projectName = (run as any).metadata?.labels?.[
        CHOREO_LABELS.WORKFLOW_PROJECT
      ];
      const componentName = (run as any).metadata?.labels?.[
        CHOREO_LABELS.WORKFLOW_COMPONENT
      ];
      if (!projectName || !componentName) return null;

      const { observerUrl } = await this.resolver.resolveForBuild(
        namespaceName,
        projectName,
        token,
      );
      if (!observerUrl) return null;

      const obsClient = createObservabilityClientWithUrl(
        observerUrl,
        token,
        this.logger,
      );

      const {
        data: obsData,
        error: obsError,
        response: obsResponse,
      } = await obsClient.GET(
        '/api/v1/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/workflow-runs/{runName}/events',
        {
          params: {
            path: { namespaceName, projectName, componentName, runName },
            query: { ...(task ? { step: task } : {}) },
          },
        },
      );

      if (obsError || !obsResponse.ok || !Array.isArray(obsData)) return null;

      const entries: WorkflowRunEventEntry[] = obsData.map((entry: any) => ({
        timestamp: entry.timestamp,
        type: entry.type,
        reason: entry.reason,
        message: entry.message,
      }));

      this.logger.debug(
        `Observer fallback: fetched ${entries.length} events for workflow run: ${runName}`,
      );

      return entries;
    } catch (err) {
      this.logger.debug(
        `Observer fallback for events of run ${runName} failed: ${err}`,
      );
      return null;
    }
  }
}
