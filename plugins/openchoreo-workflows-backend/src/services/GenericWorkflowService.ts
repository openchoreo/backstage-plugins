import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  createOpenChoreoLegacyApiClient,
  createObservabilityClientWithUrl,
} from '@openchoreo/openchoreo-client-node';
import {
  Workflow,
  WorkflowRun,
  CreateWorkflowRunRequest,
  PaginatedResponse,
  LogsResponse,
  LogEntry,
  WorkflowStepStatus,
  WorkflowRunStatusResponse,
  WorkflowRunEventEntry,
} from '../types';

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

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  /**
   * Base URL for the versioned OpenChoreo API (openchoreo-api.yaml paths include /api/v1/).
   * openapi-fetch concatenates baseUrl + path, so the baseUrl must NOT already contain /api/v1
   * when using the new typed client whose spec paths begin with /api/v1/.
   * The configured baseUrl (e.g. http://api.openchoreo.localhost:8080/api/v1) is intended for
   * the legacy client whose spec paths do NOT include the /api/v1 prefix.
   */
  private get newApiBaseUrl(): string {
    return this.baseUrl.replace(/\/api\/v1\/?$/, '');
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
      const client = createOpenChoreoLegacyApiClient({
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
        pagination: data.data?.pagination as
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
      const client = createOpenChoreoLegacyApiClient({
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
      `Fetching workflow runs for namespace: ${namespaceName}${
        workflowName ? `, workflow: ${workflowName}` : ''
      }`,
    );

    try {
      const client = createOpenChoreoLegacyApiClient({
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
        `Successfully fetched ${
          items.length
        } workflow runs for namespace: ${namespaceName}${
          workflowName ? `, workflow: ${workflowName}` : ''
        }`,
      );

      return {
        items,
        pagination: data.data?.pagination as
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
      const client = createOpenChoreoLegacyApiClient({
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
      const client = createOpenChoreoLegacyApiClient({
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

      this.logger.debug(`Successfully created workflow run: ${data.data.name}`);

      return data.data as WorkflowRun;
    } catch (error) {
      this.logger.error(
        `Failed to create workflow run for workflow ${request.workflowName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Get status and step information for a specific workflow run.
   * Attempts to call the upstream status API. Falls back to deriving status
   * from the basic workflow run data if the endpoint is not yet available.
   */
  async getWorkflowRunStatus(
    namespaceName: string,
    runName: string,
    token?: string,
  ): Promise<WorkflowRunStatusResponse> {
    this.logger.debug(
      `Fetching status for workflow run: ${runName} in namespace: ${namespaceName}`,
    );

    const client = createOpenChoreoApiClient({
      baseUrl: this.newApiBaseUrl,
      token,
      logger: this.logger,
    });

    // Try the upstream status endpoint; fall back only when endpoint is missing (404/501)
    let shouldFallback = false;
    try {
      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/workflow-runs/{runName}/status',
        {
          params: {
            path: { namespaceName, runName },
          },
        },
      );

      if (!error && response.ok) {
        const result: WorkflowRunStatusResponse = {
          status: data?.status || 'Unknown',
          steps: (data?.steps || []) as WorkflowStepStatus[],
          hasLiveObservability: data?.hasLiveObservability ?? false,
        };
        this.logger.info(
          `Workflow run ${runName}: status=${result.status}, hasLiveObservability=${result.hasLiveObservability}, steps=${result.steps.length}`,
        );
        return result;
      }

      if (response.status === 404 || response.status === 501) {
        this.logger.debug(
          `Status endpoint returned ${response.status} for ${runName}, using fallback`,
        );
        shouldFallback = true;
      } else {
        this.logger.error(
          `Failed to fetch workflow run status for ${runName}: ${response.status} ${response.statusText}`,
        );
        throw new Error(
          `Failed to fetch workflow run status: ${response.status} ${response.statusText}`,
        );
      }
    } catch (err) {
      if (!shouldFallback) {
        throw err;
      }
    }

    // Fallback: derive from basic workflow run data.
    // For Running/Pending phases, optimistically set hasLiveObservability=true
    // so the caller still attempts live logs from the build plane.
    try {
      const run = await this.getWorkflowRun(namespaceName, runName, token);
      const phase = run.phase || run.status || 'Unknown';
      const isActive = phase === 'Running' || phase === 'Pending';
      return {
        status: phase,
        steps: [{ name: runName, phase }],
        hasLiveObservability: isActive,
      };
    } catch (err) {
      this.logger.error(
        `Failed to fetch workflow run status for ${runName}: ${err}`,
      );
      throw err;
    }
  }

  /**
   * Get logs for a specific workflow run using the observability service.
   * Uses the pattern: get observer URL from environment, then fetch logs.
   *
   * @param namespaceName - The namespace name
   * @param runName - The workflow run name
   * @param environmentName - The environment name to get observer URL from (defaults to 'development')
   * @param step - Optional step name to filter logs
   * @param sinceSeconds - Only return logs from the last N seconds
   * @param token - Optional auth token
   */
  async getWorkflowRunLogs(
    namespaceName: string,
    runName: string,
    environmentName: string = 'development',
    token?: string,
    step?: string,
    sinceSeconds?: number,
  ): Promise<LogsResponse> {
    this.logger.debug(
      `Fetching logs for workflow run: ${runName} in namespace: ${namespaceName}`,
    );

    try {
      // Get status to determine whether live logs (build plane) or archived
      // logs (observer/OpenSearch) should be used — mirrors CI plugin pattern.
      let hasLiveObservability = false;
      try {
        const status = await this.getWorkflowRunStatus(
          namespaceName,
          runName,
          token,
        );
        // Only stream live logs for actively-running workflows.
        // The backend sometimes returns hasLiveObservability=true even for
        // completed runs, but Argo pod logs are gone once the workflow is
        // terminal. In that case fall through to archived logs from the observer.
        const isActive =
          status.status === 'Running' || status.status === 'Pending';
        hasLiveObservability =
          (status.hasLiveObservability ?? false) && isActive;
      } catch (statusErr) {
        this.logger.info(
          `Could not determine hasLiveObservability for ${runName}, defaulting to observer: ${statusErr}`,
        );
      }

      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      if (hasLiveObservability) {
        // ── Path A: live logs from the new API (direct from Kubernetes/Argo) ──
        const newApiClient = createOpenChoreoApiClient({
          baseUrl: this.newApiBaseUrl,
          token,
          logger: this.logger,
        });
        const { data, error, response } = await newApiClient.GET(
          '/api/v1/namespaces/{namespaceName}/workflow-runs/{runName}/logs',
          {
            params: {
              path: { namespaceName, runName },
              query: {
                ...(step ? { step } : {}),
                ...(sinceSeconds !== undefined ? { sinceSeconds } : {}),
              },
            },
          },
        );

        this.logger.info(
          `Live logs response for ${runName}: ${response.status} ${response.statusText}`,
        );

        if (!error && response.ok) {
          const entries = (data ?? []).map(e => ({
            timestamp: e.timestamp ?? '',
            log: e.log,
          }));
          this.logger.info(
            `Fetched ${entries.length} live log entries for ${runName}`,
          );
          return { logs: entries, totalCount: entries.length, tookMs: 0 };
        }

        if (!error && !response.ok && response.status !== 404) {
          throw new Error(
            `Failed to fetch workflow run logs: ${response.status} ${response.statusText}`,
          );
        }

        // Live endpoint not yet implemented (404); fall through to observer.
        this.logger.info(
          `Live logs endpoint not available (404) for ${runName}, falling back to observer`,
        );
      }

      // ── Path B: archived logs from the observer service (OpenSearch) ──────────
      const {
        data: urlData,
        error: urlError,
        response: urlResponse,
      } = await client.GET(
        '/namespaces/{namespaceName}/environments/{envName}/observer-url',
        {
          params: {
            path: { namespaceName, envName: environmentName },
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

      if (!urlData?.success || !urlData.data?.observerUrl) {
        throw new ObservabilityNotConfiguredError(runName);
      }

      const observerUrl = urlData.data.observerUrl;
      const obsClient = createObservabilityClientWithUrl(
        observerUrl,
        token,
        this.logger,
      );

      const startTime = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(); // 30 days ago
      const endTime = new Date().toISOString();

      this.logger.info(
        `Fetching archived logs from observer for ${runName}: startTime=${startTime}, step=${
          step ?? 'none'
        }`,
      );

      try {
        const {
          data: obsData,
          error: obsError,
          response: obsResponse,
        } = await obsClient.POST('/api/v1/workflow-runs/{runId}/logs', {
          params: { path: { runId: runName } },
          body: {
            namespaceName,
            startTime,
            endTime,
            limit: 1000,
            sortOrder: 'asc',
            ...(step ? { step } : {}),
          },
        });

        if (obsError || !obsResponse.ok) {
          this.logger.info(
            `Observer returned ${
              obsResponse.status
            } for ${runName}: ${JSON.stringify(obsError)}`,
          );
          throw new ObservabilityNotConfiguredError(runName);
        }

        this.logger.info(
          `Fetched ${
            obsData?.logs?.length || 0
          } archived log entries for ${runName}`,
        );
        return {
          logs: (obsData?.logs || []).map(e => ({
            timestamp: e.timestamp ?? '',
            log: e.log ?? '',
          })),
          totalCount: obsData?.totalCount || 0,
          tookMs: obsData?.tookMs || 0,
        };
      } catch (obsErr: unknown) {
        if (obsErr instanceof ObservabilityNotConfiguredError) throw obsErr;
        // Network error or other failure calling observer
        this.logger.info(`Observer call failed for ${runName}: ${obsErr}`);
        throw new ObservabilityNotConfiguredError(runName);
      }
    } catch (error: unknown) {
      if (error instanceof ObservabilityNotConfiguredError) {
        this.logger.info(`Logs not available for ${runName}: ${error.message}`);
        throw error;
      }
      this.logger.error(
        `Error fetching logs for workflow run ${runName} in namespace ${namespaceName}:`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Get logs for a specific step of a workflow run.
   * Returns LogEntry[] directly (for per-step accordion UI).
   *
   * @param namespaceName - The namespace name
   * @param runName - The workflow run name
   * @param step - The step name to filter logs by
   * @param sinceSeconds - Only return logs from the last N seconds
   * @param environmentName - The environment name (defaults to 'development')
   * @param token - Optional auth token
   */
  async getWorkflowRunStepLogs(
    namespaceName: string,
    runName: string,
    step?: string,
    sinceSeconds?: number,
    environmentName: string = 'development',
    token?: string,
  ): Promise<LogEntry[]> {
    const logsResponse = await this.getWorkflowRunLogs(
      namespaceName,
      runName,
      environmentName,
      token,
      step,
      sinceSeconds,
    );
    return logsResponse.logs;
  }

  /**
   * Get Kubernetes events for a specific step of a workflow run.
   * Calls the OpenChoreo API directly (not via the observability service).
   *
   * @param namespaceName - The namespace name
   * @param runName - The workflow run name
   * @param step - Optional step name to filter events by
   * @param token - Optional auth token
   */
  async getWorkflowRunEvents(
    namespaceName: string,
    runName: string,
    step?: string,
    token?: string,
  ): Promise<WorkflowRunEventEntry[]> {
    this.logger.debug(
      `Fetching events for workflow run: ${runName} in namespace: ${namespaceName}, step: ${step}`,
    );

    try {
      // Events are only available when the Argo workflow is still alive on the
      // build plane (hasLiveObservability=true). Kubernetes events are not
      // archived in OpenSearch, so return empty for completed/TTL-expired runs.
      let hasLiveObservability = false;
      try {
        const status = await this.getWorkflowRunStatus(
          namespaceName,
          runName,
          token,
        );
        hasLiveObservability = status.hasLiveObservability ?? false;
        this.logger.info(
          `Workflow run ${runName} events: hasLiveObservability=${hasLiveObservability}`,
        );
      } catch (statusErr) {
        this.logger.info(
          `Could not determine hasLiveObservability for ${runName} events: ${statusErr}`,
        );
      }

      if (!hasLiveObservability) {
        this.logger.debug(
          `Events not available for ${runName} (hasLiveObservability=false), returning empty list`,
        );
        return [];
      }

      const client = createOpenChoreoApiClient({
        baseUrl: this.newApiBaseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/workflow-runs/{runName}/events',
        {
          params: {
            path: { namespaceName, runName },
            query: {
              // Only send step if it differs from the run name.
              // The fallback status path synthesises step name = runName,
              // which does not correspond to any Argo node name.
              ...(step && step !== runName ? { step } : {}),
            },
          },
        },
      );

      if (error || !response.ok) {
        // 404 means the events endpoint is not yet available in the backend.
        if (response.status === 404) {
          this.logger.debug(
            `Events endpoint not implemented for ${runName}, returning empty list`,
          );
          return [];
        }
        throw new Error(
          `Failed to fetch workflow run events: ${response.status} ${response.statusText}`,
        );
      }

      const entries: WorkflowRunEventEntry[] = (data ?? []).map(entry => ({
        timestamp: entry.timestamp,
        type: entry.type,
        reason: entry.reason,
        message: entry.message,
      }));

      this.logger.info(
        `Fetched ${entries.length} events for workflow run: ${runName}`,
      );

      return entries;
    } catch (error: unknown) {
      this.logger.error(
        `Error fetching events for workflow run ${runName} in namespace ${namespaceName}:`,
        error as Error,
      );
      throw error;
    }
  }
}
