import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  createObservabilityClientWithUrl,
  assertApiResponse,
  fetchAllPages,
  ObservabilityUrlResolver,
} from '@openchoreo/openchoreo-client-node';
import {
  CHOREO_LABELS,
  type ComponentWorkflowRunResponse,
  type ComponentWorkflowRunStatusResponse,
  type WorkflowResponse,
} from '@openchoreo/backstage-plugin-common';
import {
  LogEntry,
  RuntimeLogsResponse,
  WorkflowLogEntry,
  ComponentWorkflowRunEventEntry,
} from '../types';

type ModelsBuild = ComponentWorkflowRunResponse;

type WorkflowRunStatusResponse = ComponentWorkflowRunStatusResponse;

/**
 * Derive a string status from a raw K8s WorkflowRun.
 *
 * completedAt is treated as the strongest signal: if set, the run is
 * definitively done and we never return an in-progress status, even if
 * the K8s conditions are stale (e.g. controller hasn't reconciled yet).
 */
function deriveWorkflowRunStatus(run: any): string {
  const readyCondition = (run.status?.conditions ?? []).find(
    (c: any) => c.type === 'Ready',
  );
  const tasks = (run.status?.tasks ?? []) as any[];

  // completedAt is the strongest completion signal — takes priority
  if (run.status?.completedAt) {
    if (tasks.some((t: any) => t.phase === 'Failed' || t.phase === 'Error')) {
      return 'Failed';
    }
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

/** Transform a raw K8s-style WorkflowRun object into the flat ModelsBuild shape. */
function transformWorkflowRun(run: any): ModelsBuild {
  const labels = run.metadata?.labels ?? {};
  const annotations = run.metadata?.annotations ?? {};
  const status = deriveWorkflowRunStatus(run);
  return {
    name: run.metadata?.name ?? '',
    uuid: run.metadata?.uid ?? '',
    componentName: labels[CHOREO_LABELS.WORKFLOW_COMPONENT] ?? '',
    projectName: labels[CHOREO_LABELS.WORKFLOW_PROJECT] ?? '',
    namespaceName: run.metadata?.namespace ?? '',
    status,
    commit: annotations['openchoreo.dev/commit'],
    image: annotations['openchoreo.dev/image'],
    createdAt: run.metadata?.creationTimestamp,
    workflow: run.spec?.workflow
      ? {
          name: run.spec.workflow.name,
          parameters: run.spec.workflow.parameters as Record<string, unknown>,
        }
      : undefined,
  };
}

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
  private readonly resolver: ObservabilityUrlResolver;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.resolver = new ObservabilityUrlResolver({ baseUrl, logger });
  }

  // ==================== Build Operations ====================

  async fetchBuilds(
    namespaceName: string,
    projectName: string,
    componentName: string,
    token?: string,
  ): Promise<ModelsBuild[]> {
    this.logger.debug(
      `Fetching component workflow runs for component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const allRuns = await fetchAllPages(cursor =>
        client
          .GET('/api/v1/namespaces/{namespaceName}/workflowruns', {
            params: {
              path: { namespaceName },
              query: { limit: 100, cursor },
            },
          })
          .then(res => {
            assertApiResponse(res, 'fetch component workflow runs');
            return res.data;
          }),
      );
      // Filter by component label and transform to flat response shape
      const builds = allRuns
        .filter(
          (run: any) =>
            run.metadata?.labels?.[CHOREO_LABELS.WORKFLOW_COMPONENT] ===
            componentName,
        )
        .map(transformWorkflowRun);

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
    this.logger.debug(
      `Fetching workflow run: ${runName} for component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
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

      const runLabels = (data as any).metadata?.labels ?? {};
      if (
        runLabels[CHOREO_LABELS.WORKFLOW_COMPONENT] !== componentName ||
        runLabels[CHOREO_LABELS.WORKFLOW_PROJECT] !== projectName
      ) {
        throw new Error(
          `Workflow run ${runName} does not belong to component ${componentName} in project ${projectName}`,
        );
      }

      this.logger.debug(`Successfully fetched workflow run: ${runName}`);
      return transformWorkflowRun(data);
    } catch (error) {
      this.logger.error(
        `Failed to fetch workflow run ${runName} for component ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  async getWorkflowRunStatus(
    namespaceName: string,
    projectName: string,
    componentName: string,
    runName: string,
    token?: string,
  ): Promise<WorkflowRunStatusResponse> {
    this.logger.debug(
      `Fetching workflow run status: ${runName} for component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
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

      this.logger.debug(`Successfully fetched workflow run status: ${runName}`);
      return data as WorkflowRunStatusResponse;
    } catch (error) {
      this.logger.error(
        `Failed to fetch workflow run status ${runName} for component ${componentName}: ${error}`,
      );
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
    this.logger.info(
      `Triggering component workflow for component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}${
        commit ? ` with commit: ${commit}` : ''
      }`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // Fetch component to get its configured workflow name
      const compResult = await client.GET(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: { path: { namespaceName, componentName } },
        },
      );

      assertApiResponse(
        compResult,
        `fetch component ${componentName} to determine workflow name`,
      );
      const compData = compResult.data;

      const workflowName = (compData as any)?.spec?.workflow?.name;
      const workflowKind = (compData as any)?.spec?.workflow?.kind;
      if (!workflowName) {
        throw new Error(
          `Component ${componentName} has no workflow configured`,
        );
      }

      const parameters: Record<string, unknown> = {};
      if (commit) {
        parameters.commit = commit;
      }

      const { data, error, response } = await client.POST(
        '/api/v1/namespaces/{namespaceName}/workflowruns',
        {
          params: { path: { namespaceName } },
          body: {
            metadata: {
              name: `${componentName}-${Date.now()}`,
              labels: {
                [CHOREO_LABELS.WORKFLOW_COMPONENT]: componentName,
                [CHOREO_LABELS.WORKFLOW_PROJECT]: projectName,
              },
            },
            spec: {
              workflow: {
                kind: workflowKind,
                name: workflowName,
                parameters: parameters as any,
              },
            },
          } as any,
        },
      );

      assertApiResponse(
        { data, error, response },
        'create component workflow run',
      );

      this.logger.debug(
        `Successfully triggered component workflow for component: ${componentName}, workflow run name: ${
          (data as any).metadata?.name
        }`,
      );
      return transformWorkflowRun(data);
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
      const { observerUrl } = await this.resolver.resolveForBuild(
        namespaceName,
        projectName,
        token,
      );

      if (!observerUrl) {
        throw new ObservabilityNotConfiguredError(componentName);
      }

      const obsClient = createObservabilityClientWithUrl(
        observerUrl,
        token,
        this.logger,
      );

      this.logger.debug(
        `Sending build logs request for component ${componentName} with build: ${buildId}`,
      );

      const { data, error, response } = await obsClient.POST(
        '/api/v1/logs/query',
        {
          body: {
            startTime: new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000,
            ).toISOString(), // 30 days ago
            endTime: new Date().toISOString(),
            limit: limit || 1000, // Default to 1000 until pagination is implemented
            sortOrder: sortOrder || 'asc',
            searchScope: {
              namespace: namespaceName,
              workflowRunName: buildId,
            },
          },
        },
      );

      assertApiResponse({ data, error, response }, 'fetch build logs');

      this.logger.debug(
        `Successfully fetched ${
          data!.logs?.length || 0
        } build logs for component ${componentName}`,
      );

      return {
        logs: (data!.logs as WorkflowLogEntry[]) || [],
        total: data!.total || 0,
        tookMs: data!.tookMs || 0,
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

  async fetchWorkflowRunLogs(
    namespaceName: string,
    projectName: string,
    componentName: string,
    runName: string,
    hasLiveObservability: boolean,
    options: { step?: string; sinceSeconds?: number } = {},
    token?: string,
  ): Promise<LogEntry[]> {
    this.logger.debug(
      `Fetching workflow run logs for component: ${componentName}, run: ${runName} from ${
        hasLiveObservability ? 'openchoreo-api' : 'observer-api'
      } with options: ${JSON.stringify(options)}`,
    );

    try {
      if (hasLiveObservability) {
        // Use OpenChoreo API directly for recent workflow runs
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
              query: {
                ...(options.step ? { task: options.step } : {}),
                ...(typeof options.sinceSeconds === 'number' &&
                options.sinceSeconds > 0
                  ? { sinceSeconds: options.sinceSeconds }
                  : {}),
              },
            },
          },
        );

        assertApiResponse({ data, error, response }, 'fetch workflow run logs');

        if (!Array.isArray(data)) {
          throw new Error('Failed to fetch workflow run logs: invalid payload');
        }

        const entries: LogEntry[] = data.map(entry => ({
          timestamp: entry.timestamp ?? '',
          log: entry.log,
        }));

        this.logger.debug(
          entries.length > 0
            ? `Successfully fetched ${entries.length} workflow run logs from openchoreo-api`
            : `No live logs yet for run ${runName}`,
        );
        return entries;
      }

      // Use observer API for older workflow runs
      const { observerUrl } = await this.resolver.resolveForBuild(
        namespaceName,
        projectName,
        token,
      );

      if (!observerUrl) {
        throw new ObservabilityNotConfiguredError(componentName);
      }

      const obsClient = createObservabilityClientWithUrl(
        observerUrl,
        token,
        this.logger,
      );

      this.logger.debug(
        `Sending workflow run logs request for component ${componentName} with run: ${runName}`,
      );

      // The observer rejects queries where the time range exceeds 30 days.
      // Cap the window at 29 days to stay safely within that limit regardless
      // of clock skew or boundary-comparison behaviour on the observer side.
      const maxAllowedMs = 29 * 24 * 60 * 60 * 1000;
      const requestedMs =
        typeof options.sinceSeconds === 'number' && options.sinceSeconds > 0
          ? options.sinceSeconds * 1000
          : maxAllowedMs;
      const sinceMs = Math.min(requestedMs, maxAllowedMs);
      const startTime = new Date(Date.now() - sinceMs).toISOString();
      const endTime = new Date().toISOString();

      const { data, error, response } = await obsClient.POST(
        '/api/v1/logs/query',
        {
          body: {
            startTime,
            endTime,
            limit: 1000,
            sortOrder: 'asc',
            searchScope: {
              namespace: namespaceName,
              workflowRunName: runName,
              ...(options.step ? { taskName: options.step } : {}),
            },
          },
        },
      );

      assertApiResponse({ data, error, response }, 'fetch workflow run logs');

      const entries: LogEntry[] = ((data?.logs || []) as any[]).map(
        (entry: any) => ({
          timestamp: entry.timestamp ?? '',
          log: entry.log,
        }),
      );

      this.logger.debug(
        `Successfully fetched ${entries.length} workflow run logs from observer-api`,
      );

      return entries;
    } catch (error: unknown) {
      if (error instanceof ObservabilityNotConfiguredError) {
        this.logger.info(
          `Observability not configured for component ${componentName}`,
        );
        throw error;
      }

      this.logger.error(
        `Error fetching workflow run logs for component ${componentName}:`,
        error as Error,
      );
      throw error;
    }
  }

  async fetchWorkflowRunEvents(
    namespaceName: string,
    projectName: string,
    componentName: string,
    runName: string,
    hasLiveObservability: boolean,
    step?: string,
    token?: string,
  ): Promise<ComponentWorkflowRunEventEntry[]> {
    if (!namespaceName || !projectName || !componentName || !runName) {
      throw new Error(
        'namespaceName, projectName, componentName, and runName are required fields for fetching workflow run events',
      );
    }

    this.logger.debug(
      `Fetching workflow run events for component: ${componentName}, run: ${runName}${
        step ? ` with step: ${step}` : ''
      }`,
    );

    try {
      if (hasLiveObservability) {
        // Use OpenChoreo API directly for recent workflow runs
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
                ...(step ? { task: step } : {}),
              },
            },
          },
        );

        assertApiResponse(
          { data, error, response },
          'fetch workflow run events',
        );

        if (!Array.isArray(data)) {
          throw new Error(
            'Failed to fetch workflow run events: invalid payload',
          );
        }

        const entries: ComponentWorkflowRunEventEntry[] = data.map(
          (entry: any) => ({
            timestamp: entry.timestamp,
            type: entry.type,
            reason: entry.reason,
            message: entry.message,
          }),
        );

        this.logger.debug(
          `Successfully fetched ${entries.length} workflow run events from openchoreo-api`,
        );
        return entries;
      }
      return [];
    } catch (error: unknown) {
      this.logger.error(
        `Error fetching workflow run events for component ${componentName}:`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Fetch list of component workflows for a namespace
   */
  async fetchWorkflows(
    namespaceName: string,
    token?: string,
  ): Promise<{ items: WorkflowResponse[] }> {
    this.logger.debug(
      `Fetching component workflows for namespace: ${namespaceName}`,
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

      assertApiResponse({ data, error, response }, 'fetch component workflows');

      // Map K8s-style Workflow to flat WorkflowResponse
      const items: WorkflowResponse[] = (data?.items || []).map((wf: any) => ({
        name: wf.metadata?.name ?? '',
        displayName:
          wf.metadata?.annotations?.['openchoreo.dev/display-name'] ??
          wf.metadata?.name,
        description: wf.metadata?.annotations?.['openchoreo.dev/description'],
        createdAt: wf.metadata?.creationTimestamp,
      }));

      this.logger.debug(
        `Successfully fetched ${items.length} workflows for namespace: ${namespaceName}`,
      );
      return { items };
    } catch (error) {
      this.logger.error(
        `Failed to fetch component workflows for namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Fetch JSONSchema for a specific component workflow
   */
  async fetchWorkflowSchema(
    namespaceName: string,
    workflowName: string,
    token?: string,
  ): Promise<unknown> {
    this.logger.debug(
      `Fetching schema for component workflow: ${workflowName} in namespace: ${namespaceName}`,
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

      assertApiResponse(
        { data, error, response },
        'fetch component workflow schema',
      );

      this.logger.debug(
        `Successfully fetched schema for component workflow: ${workflowName}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for component workflow ${workflowName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Update component workflow parameters by fetching the full component,
   * updating only workflow.parameters, and PUTting it back.
   */
  async updateComponentWorkflowParameters(
    namespaceName: string,
    _projectName: string,
    componentName: string,
    parameters?: { [key: string]: unknown },
    token?: string,
  ): Promise<unknown> {
    this.logger.debug(
      `Updating workflow parameters for component: ${componentName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // 1. GET the current component
      const getResult = await client.GET(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: { path: { namespaceName, componentName } },
        },
      );

      assertApiResponse(getResult, `fetch component '${componentName}'`);
      const component = getResult.data;

      // 2. Update only workflow.parameters
      const updatedComponent = {
        ...component,
        spec: {
          ...component.spec,
          workflow: {
            ...component.spec?.workflow,
            parameters: parameters ?? component.spec?.workflow?.parameters,
          },
        },
      };

      // 3. PUT the updated component back
      const {
        data: result,
        error: putError,
        response,
      } = await client.PUT(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: { path: { namespaceName, componentName } },
          body: updatedComponent as any,
        },
      );

      assertApiResponse(
        { data: result, error: putError, response },
        `update component '${componentName}'`,
      );

      this.logger.debug(
        `Successfully updated workflow parameters for component: ${componentName}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to update workflow parameters for component ${componentName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Fetch all cluster-scoped workflows
   */
  async fetchClusterWorkflows(
    token?: string,
  ): Promise<{ success: boolean; data: { items: WorkflowResponse[] } }> {
    this.logger.debug('Fetching cluster workflows');

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // TODO: Remove 'as any' once OpenAPI client is regenerated with ClusterWorkflow types
      const { data, error, response } = await (client as any).GET(
        '/api/v1/clusterworkflows',
        {
          params: {
            query: {},
          },
        },
      );

      assertApiResponse({ data, error, response }, 'fetch cluster workflows');

      const items: WorkflowResponse[] = ((data as any)?.items || []).map(
        (wf: any) => ({
          name: wf.metadata?.name ?? '',
          displayName:
            wf.metadata?.annotations?.['openchoreo.dev/display-name'] ??
            wf.metadata?.name,
          description: wf.metadata?.annotations?.['openchoreo.dev/description'],
          createdAt: wf.metadata?.creationTimestamp,
        }),
      );

      this.logger.debug(
        `Successfully fetched ${items.length} cluster workflows`,
      );
      return { success: true, data: { items } };
    } catch (error) {
      this.logger.error(`Failed to fetch cluster workflows: ${error}`);
      throw error;
    }
  }

  /**
   * Fetch JSONSchema for a specific cluster workflow
   */
  async fetchClusterWorkflowSchema(
    workflowName: string,
    token?: string,
  ): Promise<unknown> {
    this.logger.debug(`Fetching schema for cluster workflow: ${workflowName}`);

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
            path: { clusterWorkflowName: workflowName },
          },
        } as any,
      );

      assertApiResponse(
        { data, error, response },
        'fetch cluster workflow schema',
      );

      this.logger.debug(
        `Successfully fetched schema for cluster workflow: ${workflowName}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for cluster workflow ${workflowName}: ${error}`,
      );
      throw error;
    }
  }
}
