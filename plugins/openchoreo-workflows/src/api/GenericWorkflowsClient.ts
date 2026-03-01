import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import type { GenericWorkflowsClientApi } from './GenericWorkflowsClientApi';
import type {
  Workflow,
  WorkflowRun,
  PaginatedResponse,
  LogsResponse,
  WorkflowRunStatusResponse,
  WorkflowRunEventEntry,
} from '../types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class GenericWorkflowsClient implements GenericWorkflowsClientApi {
  constructor(
    private readonly discovery: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}

  private async apiFetch<T = unknown>(
    endpoint: string,
    options?: {
      method?: HttpMethod;
      body?: unknown;
      params?: Record<string, string>;
    },
  ): Promise<T> {
    const baseUrl = await this.discovery.getBaseUrl(
      'openchoreo-workflows-backend',
    );
    const url = new URL(`${baseUrl}${endpoint}`);

    if (options?.params) {
      url.search = new URLSearchParams(options.params).toString();
    }

    const headers: HeadersInit = {};

    if (options?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await this.fetchApi.fetch(url.toString(), {
      method: options?.method || 'GET',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body:
        options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  async listWorkflows(
    namespaceName: string,
  ): Promise<PaginatedResponse<Workflow>> {
    return this.apiFetch<PaginatedResponse<Workflow>>('/workflows', {
      params: { namespaceName },
    });
  }

  async getWorkflowSchema(
    namespaceName: string,
    workflowName: string,
  ): Promise<unknown> {
    return this.apiFetch<unknown>(
      `/workflows/${encodeURIComponent(workflowName)}/schema`,
      {
        params: { namespaceName },
      },
    );
  }

  async listWorkflowRuns(
    namespaceName: string,
    workflowName?: string,
  ): Promise<PaginatedResponse<WorkflowRun>> {
    const params: Record<string, string> = { namespaceName };
    if (workflowName) {
      params.workflowName = workflowName;
    }
    return this.apiFetch<PaginatedResponse<WorkflowRun>>('/workflow-runs', {
      params,
    });
  }

  async getWorkflowRun(
    namespaceName: string,
    runName: string,
  ): Promise<WorkflowRun> {
    return this.apiFetch<WorkflowRun>(
      `/workflow-runs/${encodeURIComponent(runName)}`,
      {
        params: { namespaceName },
      },
    );
  }

  async createWorkflowRun(
    namespaceName: string,
    workflowName: string,
    parameters?: Record<string, unknown>,
  ): Promise<WorkflowRun> {
    return this.apiFetch<WorkflowRun>('/workflow-runs', {
      method: 'POST',
      params: { namespaceName },
      body: { workflowName, parameters },
    });
  }

  async getWorkflowRunLogs(
    namespaceName: string,
    runName: string,
  ): Promise<LogsResponse> {
    return this.apiFetch<LogsResponse>(
      `/workflow-runs/${encodeURIComponent(runName)}/logs`,
      {
        params: { namespaceName },
      },
    );
  }

  async getWorkflowRunStatus(
    namespaceName: string,
    runName: string,
  ): Promise<WorkflowRunStatusResponse> {
    return this.apiFetch<WorkflowRunStatusResponse>(
      `/workflow-runs/${encodeURIComponent(runName)}/status`,
      {
        params: { namespaceName },
      },
    );
  }

  async getWorkflowRunEvents(
    namespaceName: string,
    runName: string,
    step?: string,
  ): Promise<WorkflowRunEventEntry[]> {
    const params: Record<string, string> = { namespaceName };
    if (step) {
      params.step = step;
    }
    return this.apiFetch<WorkflowRunEventEntry[]>(
      `/workflow-runs/${encodeURIComponent(runName)}/events`,
      { params },
    );
  }
}
