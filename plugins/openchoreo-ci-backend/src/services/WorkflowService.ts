import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  createObservabilityClientWithUrl,
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
            if (res.error || !res.response.ok) {
              throw new Error(
                `Failed to fetch component workflow runs: ${res.response.status} ${res.response.statusText}`,
              );
            }
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

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workflow run: ${response.status} ${response.statusText}`,
        );
      }

      if (!data) {
        throw new Error('No workflow run data returned');
      }

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

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workflow run status: ${response.status} ${response.statusText}`,
        );
      }

      if (!data) {
        throw new Error('No workflow run status data returned');
      }

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
      const { data: compData, error: compError } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: { path: { namespaceName, componentName } },
        },
      );

      if (compError || !compData) {
        throw new Error(
          `Failed to fetch component ${componentName} to determine workflow name`,
        );
      }

      const workflowName = (compData as any)?.spec?.workflow?.name;
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
                name: workflowName,
                parameters: parameters as any,
              },
            },
          } as any,
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to create component workflow run: ${response.status} ${response.statusText}`,
        );
      }

      if (!data) {
        throw new Error('No workflow run data returned');
      }

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
        logs: (data.logs as WorkflowLogEntry[]) || [],
        total: data.total || 0,
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

        if (error || !response.ok) {
          throw new Error(
            `Failed to fetch workflow run logs: ${response.status} ${response.statusText}`,
          );
        }

        if (!Array.isArray(data)) {
          throw new Error('Failed to fetch workflow run logs: invalid payload');
        }

        const entries: LogEntry[] = data.map(entry => ({
          timestamp: entry.timestamp ?? '',
          log: entry.log,
        }));

        this.logger.debug(
          `Successfully fetched ${entries.length} workflow run logs from openchoreo-api`,
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

      const { data, error, response } = await obsClient.GET(
        '/api/v1/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/workflow-runs/{runName}/logs',
        {
          params: {
            path: { namespaceName, projectName, componentName, runName },
            query: {
              ...(options.step ? { step: options.step } : {}),
            },
          },
        },
      );

      if (error || !response.ok) {
        if (response.status === 404) {
          this.logger.info(
            `Workflow run logs endpoint not available (404). The observability service may not support workflow run logs yet.`,
          );
          throw new ObservabilityNotConfiguredError(componentName);
        }

        this.logger.error(
          `Failed to fetch workflow run logs for component ${componentName}: ${response.status} ${response.statusText}`,
        );
        throw new Error(
          `Failed to fetch workflow run logs: ${response.status} ${response.statusText}`,
        );
      }

      const entries: LogEntry[] = (data || []).map((entry: any) => ({
        timestamp: entry.timestamp,
        log: entry.log,
      }));

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
      `Fetching workflow run events for component: ${componentName}, run: ${runName} from ${
        hasLiveObservability ? 'openchoreo-api' : 'observer-api'
      }${step ? ` with step: ${step}` : ''}`,
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

        if (error || !response.ok) {
          throw new Error(
            `Failed to fetch workflow run events: ${response.status} ${response.statusText}`,
          );
        }

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
        `Sending workflow run events request for component ${componentName} with run: ${runName}`,
      );

      const { data, error, response } = await obsClient.GET(
        '/api/v1/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/workflow-runs/{runName}/events',
        {
          params: {
            path: { namespaceName, projectName, componentName, runName },
            query: {
              ...(step ? { step } : {}),
            },
          },
        },
      );

      if (error || !response.ok) {
        if (response.status === 404) {
          this.logger.info(
            `Workflow run events endpoint not available (404). The observability service may not support workflow run events yet.`,
          );
          throw new ObservabilityNotConfiguredError(componentName);
        }

        this.logger.error(
          `Failed to fetch workflow run events for component ${componentName}: ${response.status} ${response.statusText}`,
        );
        throw new Error(
          `Failed to fetch workflow run events: ${response.status} ${response.statusText}`,
        );
      }

      const entries: ComponentWorkflowRunEventEntry[] = (data || []).map(
        (entry: any) => ({
          timestamp: entry.timestamp,
          type: entry.type,
          reason: entry.reason,
          message: entry.message,
        }),
      );

      this.logger.debug(
        `Successfully fetched ${entries.length} workflow run events from observer-api`,
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

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch component workflows: ${response.status} ${response.statusText}`,
        );
      }

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

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch component workflow schema: ${response.status} ${response.statusText}`,
        );
      }

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
   * Update component workflow parameters
   * @deprecated The workflow-parameters endpoint was removed in OpenChoreo API v0.7.
   * Workflow parameters are now managed through the component's workflow configuration.
   */
  async updateComponentWorkflowParameters(
    _namespaceName: string,
    _projectName: string,
    componentName: string,
    _systemParameters: { [key: string]: unknown },
    _parameters?: { [key: string]: unknown },
    _token?: string,
  ): Promise<unknown> {
    throw new Error(
      `updateComponentWorkflowParameters is no longer supported. The workflow-parameters API was removed in OpenChoreo v0.7. Component workflow parameters for '${componentName}' must be managed through the component configuration.`,
    );
  }
}
