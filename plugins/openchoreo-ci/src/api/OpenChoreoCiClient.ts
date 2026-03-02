import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  ModelsBuild,
  WorkflowRunStatusResponse,
  LogEntry,
} from '@openchoreo/backstage-plugin-common';
import type {
  OpenChoreoCiClientApi,
  WorkflowSchemaResponse,
  WorkflowRunEventEntry,
} from './OpenChoreoCiClientApi';

// ============================================
// Entity Metadata Utilities
// ============================================

interface EntityMetadata {
  component: string;
  project: string;
  namespace: string;
}

function extractEntityMetadata(entity: Entity): EntityMetadata {
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const namespace = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  if (!component || !project || !namespace) {
    throw new Error(
      'Missing required OpenChoreo annotations in entity. ' +
        `Required: ${CHOREO_ANNOTATIONS.COMPONENT}, ${CHOREO_ANNOTATIONS.PROJECT}, ${CHOREO_ANNOTATIONS.NAMESPACE}`,
    );
  }

  return { component, project, namespace };
}

function entityMetadataToParams(
  metadata: EntityMetadata,
): Record<string, string> {
  return {
    componentName: metadata.component,
    projectName: metadata.project,
    namespaceName: metadata.namespace,
  };
}

// ============================================
// Client Implementation
// ============================================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class OpenChoreoCiClient implements OpenChoreoCiClientApi {
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
    const baseUrl = await this.discovery.getBaseUrl('openchoreo-ci-backend');
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

  async fetchWorkflowSchema(
    namespaceName: string,
    workflowName: string,
  ): Promise<WorkflowSchemaResponse> {
    return this.apiFetch<WorkflowSchemaResponse>('/workflow-schema', {
      params: {
        namespaceName,
        workflowName,
      },
    });
  }

  async updateComponentWorkflowParameters(
    entity: Entity,
    systemParameters: Record<string, unknown> | null,
    parameters: Record<string, unknown> | null,
  ): Promise<any> {
    const metadata = extractEntityMetadata(entity);

    return this.apiFetch('/workflow-parameters', {
      method: 'PATCH',
      params: entityMetadataToParams(metadata),
      body: { systemParameters, parameters },
    });
  }

  async fetchWorkflowRunStatus(
    build: ModelsBuild,
  ): Promise<WorkflowRunStatusResponse> {
    if (
      !build.componentName ||
      !build.name ||
      !build.projectName ||
      !build.namespaceName
    ) {
      throw new Error(
        'Build object is missing required fields for fetching workflow run status',
      );
    }

    return this.apiFetch<WorkflowRunStatusResponse>('/workflow-run-status', {
      params: {
        componentName: build.componentName,
        projectName: build.projectName,
        namespaceName: build.namespaceName,
        runName: build.name,
      },
    });
  }

  async fetchWorkflowRunLogs(
    namespaceName: string,
    projectName: string,
    componentName: string,
    runName: string,
    hasLiveObservability: boolean,
    options?: { step?: string; sinceSeconds?: number },
  ): Promise<LogEntry[]> {
    if (!namespaceName || !projectName || !componentName || !runName) {
      throw new Error(
        'namespaceName, projectName, componentName and runName are required fields for fetching workflow run logs',
      );
    }

    const baseUrl = await this.discovery.getBaseUrl('openchoreo-ci-backend');
    const url = new URL(`${baseUrl}/workflow-run-logs`);

    url.searchParams.set('namespaceName', namespaceName);
    url.searchParams.set('projectName', projectName);
    url.searchParams.set('componentName', componentName);
    url.searchParams.set('runName', runName);
    url.searchParams.set(
      'hasLiveObservability',
      hasLiveObservability.toString(),
    );
    if (options?.step) {
      url.searchParams.set('step', options.step);
    }
    if (typeof options?.sinceSeconds === 'number' && options.sinceSeconds > 0) {
      url.searchParams.set('sinceSeconds', String(options.sinceSeconds));
    }

    const response = await this.fetchApi.fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch workflow run logs (${response.status}): ${errorText}`,
      );
    }

    const entries = (await response.json()) as LogEntry[];
    return entries;
  }

  async fetchWorkflowRunEvents(
    namespaceName: string,
    projectName: string,
    componentName: string,
    runName: string,
    step: string,
    hasLiveObservability: boolean,
  ): Promise<WorkflowRunEventEntry[]> {
    if (!namespaceName || !projectName || !componentName || !runName || !step) {
      throw new Error(
        'namespaceName, projectName, componentName, runName and step are required fields for fetching workflow run events',
      );
    }

    const baseUrl = await this.discovery.getBaseUrl('openchoreo-ci-backend');
    const url = new URL(`${baseUrl}/workflow-run-events`);

    url.searchParams.set('namespaceName', namespaceName);
    url.searchParams.set('projectName', projectName);
    url.searchParams.set('componentName', componentName);
    url.searchParams.set('runName', runName);
    url.searchParams.set(
      'hasLiveObservability',
      hasLiveObservability.toString(),
    );
    url.searchParams.set('step', step);

    const response = await this.fetchApi.fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 501) {
        // Workflow run events endpoint not implemented in the backend/environment
        // TODO: Remove this once the endpoint is implemented in observability plane
        throw new Error(
          `HttpNotImplemented: ${
            errorText ||
            'Events are not available for past workflow runs. This feature will be available soon.'
          }`,
        );
      }

      throw new Error(
        `Failed to fetch workflow run events (${response.status}): ${errorText}`,
      );
    }

    const entries = (await response.json()) as WorkflowRunEventEntry[];
    return entries;
  }
}
