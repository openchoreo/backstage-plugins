import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  ModelsBuild,
  RuntimeLogsResponse,
} from '@openchoreo/backstage-plugin-common';
import type {
  OpenChoreoCiClientApi,
  WorkflowSchemaResponse,
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
  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

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

  async fetchBuildLogsForBuild(
    build: ModelsBuild,
  ): Promise<RuntimeLogsResponse> {
    if (
      !build.componentName ||
      !build.name ||
      !build.uuid ||
      !build.projectName ||
      !build.namespaceName
    ) {
      throw new Error(
        'Build object is missing required fields for fetching logs',
      );
    }

    return this.apiFetch<RuntimeLogsResponse>('/build-logs', {
      params: {
        componentName: build.componentName,
        buildId: build.name,
        projectName: build.projectName,
        namespaceName: build.namespaceName,
      },
    });
  }
}
