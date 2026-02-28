import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  ModelsWorkload,
  ModelsBuild,
  RuntimeLogsResponse,
} from '@openchoreo/backstage-plugin-common';
import { CLUSTER_SCOPED_RESOURCE_KINDS } from './OpenChoreoClientApi';
import type {
  OpenChoreoClientApi,
  CreateReleaseResponse,
  SchemaResponse,
  ReleaseBindingsResponse,
  WorkflowSchemaResponse,
  ComponentInfo,
  SecretReferencesResponse,
  BuildLogsParams,
  ComponentTrait,
  UserTypeConfig,
  NamespaceSummary,
  ProjectSummary,
  ComponentSummary,
  GitSecret,
  GitSecretsListResponse,
  PlatformResourceKind,
  ResourceCRUDResponse,
  ClusterRole,
  NamespaceRole,
  ClusterRoleBinding,
  ClusterRoleBindingRequest,
  NamespaceRoleBinding,
  NamespaceRoleBindingRequest,
  ClusterRoleBindingFilters,
  NamespaceRoleBindingFilters,
  ForceDeleteResult,
  RoleBindingsLookup,
  ResourceEventsResponse,
  PodLogsResponse,
} from './OpenChoreoClientApi';
import type { Environment } from '../components/RuntimeLogs/types';

// ============================================
// API Endpoints
// ============================================

const API_ENDPOINTS = {
  ENVIRONMENT_INFO: '/deploy',
  PROMOTE_DEPLOYMENT: '/promote-deployment',
  DELETE_RELEASE_BINDING: '/delete-release-binding',
  CELL_DIAGRAM: '/cell-diagram',
  DEPLOYEMNT_WORKLOAD: '/workload',
  UPDATE_BINDING: '/update-binding',
  DASHBOARD_BINDINGS_COUNT: '/dashboard/bindings-count',
  CREATE_RELEASE: '/create-release',
  DEPLOY_RELEASE: '/deploy-release',
  COMPONENT_RELEASE_SCHEMA: '/component-release-schema',
  RELEASE_BINDINGS: '/release-bindings',
  PATCH_RELEASE_BINDING: '/patch-release-binding',
  ENVIRONMENT_RELEASE: '/environment-release',
  RESOURCE_TREE: '/resourcetree',
  RESOURCE_EVENTS: '/resource-events',
  POD_LOGS: '/pod-logs',
  WORKFLOW_SCHEMA: '/workflow-schema',
  COMPONENT_WORKFLOW_PARAMETERS: '/workflow-parameters',
  SECRET_REFERENCES: '/secret-references',
  COMPONENT: '/component',
  BUILD_LOGS: '/build-logs',
  DEPLOYMENT_PIPELINE: '/deployment-pipeline',
  BUILDS: '/builds',
  COMPONENT_TRAITS: '/component-traits',
  TRAITS: '/traits',
  TRAIT_SCHEMA: '/trait-schema',
  CLUSTER_TRAITS: '/cluster-traits',
  CLUSTER_TRAIT_SCHEMA: '/cluster-trait-schema',
  // Authorization endpoints
  AUTHZ_ACTIONS: '/authz/actions',
  // Configuration endpoints
  USER_TYPES: '/user-types',
  // Git secrets endpoints
  GIT_SECRETS: '/git-secrets',
  // Hierarchy data endpoints
  NAMESPACES: '/namespaces',
  PROJECTS: '/projects', // GET /namespaces/{namespaceName}/projects
  COMPONENTS: '/components', // GET /namespaces/{namespaceName}/projects/{projectName}/components
  ENTITY_ANNOTATIONS: '/entity-annotations',
  // Platform resource definition endpoint
  PLATFORM_RESOURCE_DEFINITION: '/platform-resource/definition',
  // Cluster/Namespace scoped authorization endpoints
  CLUSTER_ROLES: '/clusterroles',
  CLUSTER_ROLE_BINDINGS: '/clusterrolebindings',
} as const;

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

function tryExtractEntityMetadata(entity: Entity): EntityMetadata | null {
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const namespace = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  if (!component || !project || !namespace) {
    return null;
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
// OpenChoreo Client Implementation
// ============================================

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

/**
 * OpenChoreo Client - implements all OpenChoreo backend operations.
 *
 * This class encapsulates all API calls to the OpenChoreo backend,
 * handling authentication, URL construction, and error handling.
 */
export class OpenChoreoClient implements OpenChoreoClientApi {
  constructor(
    private readonly discovery: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}

  // ============================================
  // Private Helpers
  // ============================================

  private async apiFetch<T = unknown>(
    endpoint: string,
    options?: {
      method?: HttpMethod;
      body?: unknown;
      params?: Record<string, string>;
    },
  ): Promise<T> {
    const baseUrl = await this.discovery.getBaseUrl('openchoreo');
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

    // Handle 204 No Content responses (e.g., successful deletes)
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ============================================
  // Environment Operations
  // ============================================

  async fetchEnvironmentInfo(entity: Entity): Promise<any> {
    const metadata = tryExtractEntityMetadata(entity);
    if (!metadata) {
      return [];
    }

    return this.apiFetch(API_ENDPOINTS.ENVIRONMENT_INFO, {
      params: entityMetadataToParams(metadata),
    });
  }

  async promoteToEnvironment(
    entity: Entity,
    sourceEnvironment: string,
    targetEnvironment: string,
  ): Promise<any> {
    const { component, project, namespace } = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.PROMOTE_DEPLOYMENT, {
      method: 'POST',
      body: {
        sourceEnv: sourceEnvironment,
        targetEnv: targetEnvironment,
        componentName: component,
        projectName: project,
        namespaceName: namespace,
      },
    });
  }

  async deleteReleaseBinding(
    entity: Entity,
    environment: string,
  ): Promise<any> {
    const { component, project, namespace } = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.DELETE_RELEASE_BINDING, {
      method: 'DELETE',
      body: {
        namespaceName: namespace,
        projectName: project,
        componentName: component,
        environment,
      },
    });
  }

  async updateComponentBinding(
    entity: Entity,
    bindingName: string,
    releaseState: 'Active' | 'Suspend' | 'Undeploy',
  ): Promise<any> {
    const { component, project, namespace } = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.UPDATE_BINDING, {
      method: 'PATCH',
      body: {
        namespaceName: namespace,
        projectName: project,
        componentName: component,
        bindingName,
        releaseState,
      },
    });
  }

  async patchComponent(entity: Entity, autoDeploy: boolean): Promise<any> {
    const { component, project, namespace } = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.COMPONENT, {
      method: 'PATCH',
      body: {
        namespaceName: namespace,
        projectName: project,
        componentName: component,
        autoDeploy,
      },
    });
  }

  async createComponentRelease(
    entity: Entity,
    releaseName?: string,
  ): Promise<CreateReleaseResponse> {
    const metadata = extractEntityMetadata(entity);

    return this.apiFetch<CreateReleaseResponse>(API_ENDPOINTS.CREATE_RELEASE, {
      method: 'POST',
      params: entityMetadataToParams(metadata),
      body: { releaseName },
    });
  }

  async deployRelease(entity: Entity, releaseName: string): Promise<any> {
    const metadata = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.DEPLOY_RELEASE, {
      method: 'POST',
      params: entityMetadataToParams(metadata),
      body: { releaseName },
    });
  }

  async fetchComponentReleaseSchema(
    entity: Entity,
    releaseName: string,
  ): Promise<SchemaResponse> {
    const metadata = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.COMPONENT_RELEASE_SCHEMA, {
      params: {
        ...entityMetadataToParams(metadata),
        releaseName,
      },
    });
  }

  async fetchReleaseBindings(entity: Entity): Promise<ReleaseBindingsResponse> {
    const metadata = extractEntityMetadata(entity);

    return this.apiFetch<ReleaseBindingsResponse>(
      API_ENDPOINTS.RELEASE_BINDINGS,
      {
        params: entityMetadataToParams(metadata),
      },
    );
  }

  async patchReleaseBindingOverrides(
    entity: Entity,
    environment: string,
    componentTypeEnvOverrides?: unknown,
    traitOverrides?: unknown,
    workloadOverrides?: any,
    releaseName?: string,
  ): Promise<any> {
    const { component, project, namespace } = extractEntityMetadata(entity);

    const patchReq: Record<string, unknown> = {
      namespaceName: namespace,
      projectName: project,
      componentName: component,
      environment,
    };

    if (componentTypeEnvOverrides !== undefined) {
      patchReq.componentTypeEnvOverrides = componentTypeEnvOverrides;
    }
    if (traitOverrides !== undefined) {
      patchReq.traitOverrides = traitOverrides;
    }
    if (workloadOverrides !== undefined) {
      patchReq.workloadOverrides = workloadOverrides;
    }
    if (releaseName !== undefined) {
      patchReq.releaseName = releaseName;
    }

    return this.apiFetch(API_ENDPOINTS.PATCH_RELEASE_BINDING, {
      method: 'PATCH',
      body: patchReq,
    });
  }

  async fetchEnvironmentRelease(
    entity: Entity,
    environmentName: string,
  ): Promise<any> {
    const metadata = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.ENVIRONMENT_RELEASE, {
      params: {
        ...entityMetadataToParams(metadata),
        environmentName,
      },
    });
  }

  async fetchResourceTree(
    namespaceName: string,
    releaseBindingName: string,
  ): Promise<any> {
    return this.apiFetch(API_ENDPOINTS.RESOURCE_TREE, {
      params: {
        namespaceName,
        releaseBindingName,
      },
    });
  }

  async fetchResourceEvents(
    namespaceName: string,
    releaseBindingName: string,
    resourceParams: {
      group: string;
      version: string;
      kind: string;
      name: string;
    },
  ): Promise<ResourceEventsResponse> {
    return this.apiFetch<ResourceEventsResponse>(
      API_ENDPOINTS.RESOURCE_EVENTS,
      {
        params: {
          namespaceName,
          releaseBindingName,
          group: resourceParams.group,
          version: resourceParams.version,
          kind: resourceParams.kind,
          name: resourceParams.name,
        },
      },
    );
  }

  async fetchPodLogs(
    namespaceName: string,
    releaseBindingName: string,
    params: {
      podName: string;
      sinceSeconds?: number;
    },
  ): Promise<PodLogsResponse> {
    const queryParams: Record<string, string> = {
      namespaceName,
      releaseBindingName,
      podName: params.podName,
    };
    if (params.sinceSeconds !== undefined) {
      queryParams.sinceSeconds = params.sinceSeconds.toString();
    }

    return this.apiFetch<PodLogsResponse>(API_ENDPOINTS.POD_LOGS, {
      params: queryParams,
    });
  }

  // ============================================
  // Workload Operations
  // ============================================

  async fetchWorkloadInfo(entity: Entity): Promise<ModelsWorkload> {
    const metadata = extractEntityMetadata(entity);

    return this.apiFetch<ModelsWorkload>(API_ENDPOINTS.DEPLOYEMNT_WORKLOAD, {
      params: entityMetadataToParams(metadata),
    });
  }

  async applyWorkload(
    entity: Entity,
    workloadSpec: ModelsWorkload,
  ): Promise<any> {
    const metadata = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.DEPLOYEMNT_WORKLOAD, {
      method: 'POST',
      params: entityMetadataToParams(metadata),
      body: workloadSpec,
    });
  }

  // ============================================
  // Workflow Operations
  // ============================================

  async fetchWorkflowSchema(
    namespaceName: string,
    workflowName: string,
  ): Promise<WorkflowSchemaResponse> {
    return this.apiFetch<WorkflowSchemaResponse>(
      API_ENDPOINTS.WORKFLOW_SCHEMA,
      {
        params: {
          namespaceName,
          workflowName,
        },
      },
    );
  }

  async updateComponentWorkflowParameters(
    entity: Entity,
    systemParameters: Record<string, unknown> | null,
    parameters: Record<string, unknown> | null,
  ): Promise<any> {
    const metadata = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.COMPONENT_WORKFLOW_PARAMETERS, {
      method: 'PATCH',
      params: entityMetadataToParams(metadata),
      body: { systemParameters, parameters },
    });
  }

  // ============================================
  // Runtime Logs
  // ============================================

  async getComponentDetails(
    entity: Entity,
  ): Promise<{ uid?: string; deletionTimestamp?: string }> {
    const metadata = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.COMPONENT, {
      params: entityMetadataToParams(metadata),
    });
  }

  async getProjectDetails(
    entity: Entity,
  ): Promise<{ uid?: string; deletionTimestamp?: string }> {
    const projectName = entity.metadata.name;
    const namespaceName =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

    if (!projectName || !namespaceName) {
      throw new Error(
        'Missing required OpenChoreo annotations for project details. ' +
          `Required: project name and ${CHOREO_ANNOTATIONS.NAMESPACE}`,
      );
    }

    return this.apiFetch('/project', {
      params: {
        projectName,
        namespaceName,
      },
    });
  }

  async getEnvironments(entity: Entity): Promise<Environment[]> {
    const metadata = tryExtractEntityMetadata(entity);
    if (!metadata) {
      return [];
    }

    const envData = await this.apiFetch<any[]>(API_ENDPOINTS.ENVIRONMENT_INFO, {
      params: entityMetadataToParams(metadata),
    });

    // Transform the environment data to match our interface
    return envData.map((env: any) => ({
      id: env.uid || env.name,
      name: env.displayName || env.name,
      resourceName: env.resourceName || env.name,
    }));
  }

  // ============================================
  // Build Logs
  // ============================================

  async getBuildLogs(params: BuildLogsParams): Promise<RuntimeLogsResponse> {
    interface BuildLogsApiResponse {
      success?: boolean;
      data?: {
        message?: string;
      };
      logs?: RuntimeLogsResponse['logs'];
      totalCount?: number;
      tookMs?: number;
    }

    const data = await this.apiFetch<BuildLogsApiResponse>(
      API_ENDPOINTS.BUILD_LOGS,
      {
        params: {
          componentName: params.componentName,
          buildId: params.buildId,
          buildUuid: params.buildUuid,
          limit: (params.limit || 100).toString(),
          sortOrder: params.sortOrder || 'desc',
          projectName: params.projectName,
          namespaceName: params.namespaceName,
        },
      },
    );

    if (
      data.success &&
      data.data?.message === 'observability-logs have not been configured'
    ) {
      throw new Error(
        "Observability has not been configured so build logs aren't available",
      );
    }

    return data as RuntimeLogsResponse;
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
        'Component name, Build ID, UUID, Project name, or Namespace name not available',
      );
    }

    return this.getBuildLogs({
      componentName: build.componentName,
      buildId: build.name,
      buildUuid: build.uuid,
      projectName: build.projectName,
      namespaceName: build.namespaceName,
      limit: 100,
      sortOrder: 'desc',
    });
  }

  async fetchBuilds(
    componentName: string,
    projectName: string,
    namespaceName: string,
  ): Promise<any[]> {
    try {
      return await this.apiFetch<any[]>(API_ENDPOINTS.BUILDS, {
        params: {
          componentName,
          projectName,
          namespaceName,
        },
      });
    } catch {
      return [];
    }
  }

  // ============================================
  // Other
  // ============================================

  async getCellDiagramInfo(entity: Entity): Promise<any> {
    const project = entity.metadata.name;
    const namespace =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

    if (!project || !namespace) {
      return [];
    }

    return this.apiFetch(API_ENDPOINTS.CELL_DIAGRAM, {
      params: {
        projectName: project,
        namespaceName: namespace,
      },
    });
  }

  async fetchTotalBindingsCount(components: ComponentInfo[]): Promise<number> {
    const data = await this.apiFetch<{ totalBindings: number }>(
      API_ENDPOINTS.DASHBOARD_BINDINGS_COUNT,
      {
        method: 'POST',
        body: { components },
      },
    );

    return data.totalBindings;
  }

  async fetchSecretReferences(
    entity: Entity,
  ): Promise<SecretReferencesResponse> {
    const namespaceName =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

    if (!namespaceName) {
      throw new Error('Missing namespace annotation');
    }

    return this.fetchSecretReferencesByNamespace(namespaceName);
  }

  async fetchSecretReferencesByNamespace(
    namespaceName: string,
  ): Promise<SecretReferencesResponse> {
    return this.apiFetch<SecretReferencesResponse>(
      API_ENDPOINTS.SECRET_REFERENCES,
      {
        params: { namespaceName },
      },
    );
  }

  async fetchDeploymentPipeline(
    projectName: string,
    namespaceName: string,
  ): Promise<any> {
    return this.apiFetch(API_ENDPOINTS.DEPLOYMENT_PIPELINE, {
      params: {
        projectName,
        namespaceName,
      },
    });
  }

  // ============================================
  // Traits Operations
  // ============================================

  async fetchComponentTraits(entity: Entity): Promise<ComponentTrait[]> {
    const metadata = extractEntityMetadata(entity);

    return this.apiFetch<ComponentTrait[]>(API_ENDPOINTS.COMPONENT_TRAITS, {
      params: entityMetadataToParams(metadata),
    });
  }

  async updateComponentTraits(
    entity: Entity,
    traits: ComponentTrait[],
  ): Promise<ComponentTrait[]> {
    const metadata = extractEntityMetadata(entity);

    return this.apiFetch<ComponentTrait[]>(API_ENDPOINTS.COMPONENT_TRAITS, {
      method: 'PUT',
      body: {
        namespaceName: metadata.namespace,
        projectName: metadata.project,
        componentName: metadata.component,
        traits,
      },
    });
  }

  async fetchTraitsByNamespace(
    namespaceName: string,
    page: number = 1,
    pageSize: number = 100,
  ): Promise<any> {
    return this.apiFetch(API_ENDPOINTS.TRAITS, {
      params: {
        namespaceName,
        page: page.toString(),
        pageSize: pageSize.toString(),
      },
    });
  }

  async fetchTraitSchemaByNamespace(
    namespaceName: string,
    traitName: string,
  ): Promise<any> {
    return this.apiFetch(API_ENDPOINTS.TRAIT_SCHEMA, {
      params: { namespaceName, traitName },
    });
  }

  async fetchClusterTraits(): Promise<any> {
    return this.apiFetch(API_ENDPOINTS.CLUSTER_TRAITS);
  }

  async fetchClusterTraitSchema(clusterTraitName: string): Promise<any> {
    return this.apiFetch(API_ENDPOINTS.CLUSTER_TRAIT_SCHEMA, {
      params: { clusterTraitName },
    });
  }

  // ============================================
  // Authorization Operations
  // ============================================

  async listActions(): Promise<string[]> {
    const response = await this.apiFetch<{ data: string[] }>(
      API_ENDPOINTS.AUTHZ_ACTIONS,
    );
    return response.data || [];
  }

  async listUserTypes(): Promise<UserTypeConfig[]> {
    const response = await this.apiFetch<{ data: UserTypeConfig[] }>(
      API_ENDPOINTS.USER_TYPES,
    );
    return response.data || [];
  }

  // ============================================
  // Hierarchy Data Operations
  // ============================================

  async listNamespaces(): Promise<NamespaceSummary[]> {
    const response = await this.apiFetch<{ data: NamespaceSummary[] }>(
      API_ENDPOINTS.NAMESPACES,
    );
    return response.data || [];
  }

  async listProjects(namespaceName: string): Promise<ProjectSummary[]> {
    const response = await this.apiFetch<{ data: ProjectSummary[] }>(
      `/namespaces/${encodeURIComponent(namespaceName)}/projects`,
    );
    return response.data || [];
  }

  async listComponents(
    namespaceName: string,
    projectName: string,
  ): Promise<ComponentSummary[]> {
    const response = await this.apiFetch<{ data: ComponentSummary[] }>(
      `/namespaces/${encodeURIComponent(
        namespaceName,
      )}/projects/${encodeURIComponent(projectName)}/components`,
    );
    return response.data || [];
  }

  async fetchDataPlaneDetails(
    namespaceName: string,
    dataplaneName: string,
  ): Promise<any> {
    const response = await this.apiFetch<any>(
      `/dataplanes/${encodeURIComponent(
        dataplaneName,
      )}?namespaceName=${encodeURIComponent(namespaceName)}`,
    );
    return response;
  }

  // ============================================
  // Entity Delete Operations
  // ============================================

  async deleteComponent(entity: Entity): Promise<void> {
    const { component, project, namespace } = extractEntityMetadata(entity);

    await this.apiFetch(
      `/namespaces/${encodeURIComponent(
        namespace,
      )}/projects/${encodeURIComponent(
        project,
      )}/components/${encodeURIComponent(component)}`,
      {
        method: 'DELETE',
      },
    );
  }
  // Cluster Roles Operations
  // ============================================

  async listClusterRoles(): Promise<ClusterRole[]> {
    const response = await this.apiFetch<{ data: ClusterRole[] }>(
      API_ENDPOINTS.CLUSTER_ROLES,
    );
    return response.data || [];
  }

  async getClusterRole(name: string): Promise<ClusterRole> {
    const response = await this.apiFetch<{ data: ClusterRole }>(
      `${API_ENDPOINTS.CLUSTER_ROLES}/${encodeURIComponent(name)}`,
    );
    return response.data;
  }

  async createClusterRole(role: ClusterRole): Promise<ClusterRole> {
    const response = await this.apiFetch<{ data: ClusterRole }>(
      API_ENDPOINTS.CLUSTER_ROLES,
      {
        method: 'POST',
        body: role,
      },
    );
    return response.data;
  }

  async updateClusterRole(
    name: string,
    role: Partial<ClusterRole>,
  ): Promise<ClusterRole> {
    const response = await this.apiFetch<{ data: ClusterRole }>(
      `${API_ENDPOINTS.CLUSTER_ROLES}/${encodeURIComponent(name)}`,
      {
        method: 'PUT',
        body: role,
      },
    );
    return response.data;
  }

  async deleteClusterRole(name: string): Promise<void> {
    await this.apiFetch(
      `${API_ENDPOINTS.CLUSTER_ROLES}/${encodeURIComponent(name)}`,
      {
        method: 'DELETE',
      },
    );
  }

  // ============================================
  // Custom Annotation Operations
  // ============================================

  async fetchEntityAnnotations(
    entity: Entity,
  ): Promise<Record<string, string>> {
    const entityRef = stringifyEntityRef(entity);
    const result = await this.apiFetch<{
      annotations: Record<string, string>;
    }>(API_ENDPOINTS.ENTITY_ANNOTATIONS, {
      params: { entityRef },
    });
    return result.annotations;
  }

  async updateEntityAnnotations(
    entity: Entity,
    annotations: Record<string, string | null>,
  ): Promise<Record<string, string>> {
    const entityRef = stringifyEntityRef(entity);
    const result = await this.apiFetch<{
      annotations: Record<string, string>;
    }>(API_ENDPOINTS.ENTITY_ANNOTATIONS, {
      method: 'PATCH',
      body: { entityRef, annotations },
    });
    return result.annotations;
  }

  async deleteProject(entity: Entity): Promise<void> {
    const project = entity.metadata.name;
    const namespaceName =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

    if (!project || !namespaceName) {
      throw new Error(
        'Missing required OpenChoreo annotations for project deletion. ' +
          `Required: project name and ${CHOREO_ANNOTATIONS.NAMESPACE}`,
      );
    }

    await this.apiFetch(
      `/namespaces/${encodeURIComponent(
        namespaceName,
      )}/projects/${encodeURIComponent(project)}`,
      {
        method: 'DELETE',
      },
    );
  }
  // ============================================
  // Namespace Roles Operations
  // ============================================

  async listNamespaceRoles(namespace: string): Promise<NamespaceRole[]> {
    const response = await this.apiFetch<{ data: NamespaceRole[] }>(
      `${API_ENDPOINTS.NAMESPACES}/${encodeURIComponent(namespace)}/roles`,
    );
    return response.data || [];
  }

  async getNamespaceRole(
    namespace: string,
    name: string,
  ): Promise<NamespaceRole> {
    const response = await this.apiFetch<{ data: NamespaceRole }>(
      `${API_ENDPOINTS.NAMESPACES}/${encodeURIComponent(
        namespace,
      )}/roles/${encodeURIComponent(name)}`,
    );
    return response.data;
  }

  async createNamespaceRole(role: NamespaceRole): Promise<NamespaceRole> {
    const response = await this.apiFetch<{ data: NamespaceRole }>(
      `${API_ENDPOINTS.NAMESPACES}/${encodeURIComponent(role.namespace)}/roles`,
      {
        method: 'POST',
        body: role,
      },
    );
    return response.data;
  }

  async updateNamespaceRole(
    namespace: string,
    name: string,
    role: Partial<NamespaceRole>,
  ): Promise<NamespaceRole> {
    const response = await this.apiFetch<{ data: NamespaceRole }>(
      `${API_ENDPOINTS.NAMESPACES}/${encodeURIComponent(
        namespace,
      )}/roles/${encodeURIComponent(name)}`,
      {
        method: 'PUT',
        body: role,
      },
    );
    return response.data;
  }

  async deleteNamespaceRole(namespace: string, name: string): Promise<void> {
    await this.apiFetch(
      `${API_ENDPOINTS.NAMESPACES}/${encodeURIComponent(
        namespace,
      )}/roles/${encodeURIComponent(name)}`,
      {
        method: 'DELETE',
      },
    );
  }

  // ============================================
  // Cluster Role Bindings Operations
  // ============================================

  async listClusterRoleBindings(
    filters?: ClusterRoleBindingFilters,
  ): Promise<ClusterRoleBinding[]> {
    const params = new URLSearchParams();
    if (filters?.roleName) {
      params.set('roleName', filters.roleName);
    }
    if (filters?.claim) {
      params.set('claim', filters.claim);
    }
    if (filters?.value) {
      params.set('value', filters.value);
    }
    if (filters?.effect) {
      params.set('effect', filters.effect);
    }
    const queryString = params.toString();
    const url = queryString
      ? `${API_ENDPOINTS.CLUSTER_ROLE_BINDINGS}?${queryString}`
      : API_ENDPOINTS.CLUSTER_ROLE_BINDINGS;

    const response = await this.apiFetch<{ data: ClusterRoleBinding[] }>(url);
    return response.data || [];
  }

  async getClusterRoleBinding(name: string): Promise<ClusterRoleBinding> {
    const response = await this.apiFetch<{ data: ClusterRoleBinding }>(
      `${API_ENDPOINTS.CLUSTER_ROLE_BINDINGS}/${encodeURIComponent(name)}`,
    );
    return response.data;
  }

  async createClusterRoleBinding(
    binding: ClusterRoleBindingRequest,
  ): Promise<ClusterRoleBinding> {
    const response = await this.apiFetch<{ data: ClusterRoleBinding }>(
      API_ENDPOINTS.CLUSTER_ROLE_BINDINGS,
      {
        method: 'POST',
        body: binding,
      },
    );
    return response.data;
  }

  async updateClusterRoleBinding(
    name: string,
    binding: Partial<ClusterRoleBindingRequest>,
  ): Promise<ClusterRoleBinding> {
    const response = await this.apiFetch<{ data: ClusterRoleBinding }>(
      `${API_ENDPOINTS.CLUSTER_ROLE_BINDINGS}/${encodeURIComponent(name)}`,
      {
        method: 'PUT',
        body: binding,
      },
    );
    return response.data;
  }

  async deleteClusterRoleBinding(name: string): Promise<void> {
    await this.apiFetch(
      `${API_ENDPOINTS.CLUSTER_ROLE_BINDINGS}/${encodeURIComponent(name)}`,
      {
        method: 'DELETE',
      },
    );
  }

  // ============================================
  // Namespace Role Bindings Operations
  // ============================================

  async listNamespaceRoleBindings(
    namespace: string,
    filters?: NamespaceRoleBindingFilters,
  ): Promise<NamespaceRoleBinding[]> {
    const params = new URLSearchParams();
    if (filters?.roleName) {
      params.set('roleName', filters.roleName);
    }
    if (filters?.roleNamespace) {
      params.set('roleNamespace', filters.roleNamespace);
    }
    if (filters?.claim) {
      params.set('claim', filters.claim);
    }
    if (filters?.value) {
      params.set('value', filters.value);
    }
    if (filters?.effect) {
      params.set('effect', filters.effect);
    }
    const queryString = params.toString();
    const baseUrl = `${API_ENDPOINTS.NAMESPACES}/${encodeURIComponent(
      namespace,
    )}/rolebindings`;
    const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;

    const response = await this.apiFetch<{ data: NamespaceRoleBinding[] }>(url);
    return response.data || [];
  }

  async getNamespaceRoleBinding(
    namespace: string,
    name: string,
  ): Promise<NamespaceRoleBinding> {
    const response = await this.apiFetch<{ data: NamespaceRoleBinding }>(
      `${API_ENDPOINTS.NAMESPACES}/${encodeURIComponent(
        namespace,
      )}/rolebindings/${encodeURIComponent(name)}`,
    );
    return response.data;
  }

  async createNamespaceRoleBinding(
    namespace: string,
    binding: NamespaceRoleBindingRequest,
  ): Promise<NamespaceRoleBinding> {
    const response = await this.apiFetch<{ data: NamespaceRoleBinding }>(
      `${API_ENDPOINTS.NAMESPACES}/${encodeURIComponent(
        namespace,
      )}/rolebindings`,
      {
        method: 'POST',
        body: binding,
      },
    );
    return response.data;
  }

  async updateNamespaceRoleBinding(
    namespace: string,
    name: string,
    binding: NamespaceRoleBindingRequest,
  ): Promise<NamespaceRoleBinding> {
    const response = await this.apiFetch<{ data: NamespaceRoleBinding }>(
      `${API_ENDPOINTS.NAMESPACES}/${encodeURIComponent(
        namespace,
      )}/rolebindings/${encodeURIComponent(name)}`,
      {
        method: 'PUT',
        body: binding,
      },
    );
    return response.data;
  }

  async deleteNamespaceRoleBinding(
    namespace: string,
    name: string,
  ): Promise<void> {
    await this.apiFetch(
      `${API_ENDPOINTS.NAMESPACES}/${encodeURIComponent(
        namespace,
      )}/rolebindings/${encodeURIComponent(name)}`,
      {
        method: 'DELETE',
      },
    );
  }

  // ============================================
  // Binding Lookup & Force-Delete Operations
  // ============================================

  async listBindingsForClusterRole(name: string): Promise<RoleBindingsLookup> {
    return this.apiFetch<RoleBindingsLookup>(
      `${API_ENDPOINTS.CLUSTER_ROLES}/${encodeURIComponent(name)}/bindings`,
    );
  }

  async listBindingsForNamespaceRole(
    namespace: string,
    name: string,
  ): Promise<RoleBindingsLookup> {
    return this.apiFetch<RoleBindingsLookup>(
      `${API_ENDPOINTS.NAMESPACES}/${encodeURIComponent(
        namespace,
      )}/roles/${encodeURIComponent(name)}/bindings`,
    );
  }

  async forceDeleteClusterRole(name: string): Promise<ForceDeleteResult> {
    return this.apiFetch<ForceDeleteResult>(
      `${API_ENDPOINTS.CLUSTER_ROLES}/${encodeURIComponent(name)}/force-delete`,
      {
        method: 'POST',
      },
    );
  }

  async forceDeleteNamespaceRole(
    namespace: string,
    name: string,
  ): Promise<ForceDeleteResult> {
    return this.apiFetch<ForceDeleteResult>(
      `${API_ENDPOINTS.NAMESPACES}/${encodeURIComponent(
        namespace,
      )}/roles/${encodeURIComponent(name)}/force-delete`,
      {
        method: 'POST',
      },
    );
  }

  // ============================================
  // Git Secrets Operations
  // ============================================

  async listGitSecrets(namespaceName: string): Promise<GitSecretsListResponse> {
    return this.apiFetch<GitSecretsListResponse>(API_ENDPOINTS.GIT_SECRETS, {
      params: { namespaceName },
    });
  }

  async createGitSecret(
    namespaceName: string,
    secretName: string,
    secretType: 'basic-auth' | 'ssh-auth',
    tokenOrKey: string,
    username?: string,
    sshKeyId?: string,
  ): Promise<GitSecret> {
    const requestBody: any = {
      secretName,
      secretType,
    };

    if (secretType === 'basic-auth') {
      requestBody.token = tokenOrKey;
      if (username) {
        requestBody.username = username;
      }
    } else {
      requestBody.sshKey = tokenOrKey;
      if (sshKeyId) {
        requestBody.sshKeyId = sshKeyId;
      }
    }

    return this.apiFetch<GitSecret>(API_ENDPOINTS.GIT_SECRETS, {
      method: 'POST',
      params: { namespaceName },
      body: requestBody,
    });
  }

  async deleteGitSecret(
    namespaceName: string,
    secretName: string,
  ): Promise<void> {
    await this.apiFetch<void>(
      `${API_ENDPOINTS.GIT_SECRETS}/${encodeURIComponent(secretName)}`,
      {
        method: 'DELETE',
        params: { namespaceName },
      },
    );
  }

  // ============================================
  // Platform Resource Definition Operations
  // ============================================

  async getResourceDefinition(
    kind: PlatformResourceKind,
    namespaceName: string,
    resourceName: string,
  ): Promise<Record<string, unknown>> {
    const params: Record<string, string> = {
      kind,
      resourceName,
    };

    if (!CLUSTER_SCOPED_RESOURCE_KINDS.has(kind)) {
      params.namespaceName = namespaceName;
    }

    const response = await this.apiFetch<{
      success: boolean;
      data?: Record<string, unknown>;
    }>(API_ENDPOINTS.PLATFORM_RESOURCE_DEFINITION, {
      params,
    });

    if (!response.data) {
      throw new Error(`No data returned for ${kind} ${resourceName}`);
    }

    return response.data;
  }

  async updateResourceDefinition(
    kind: PlatformResourceKind,
    namespaceName: string,
    resourceName: string,
    resource: Record<string, unknown>,
  ): Promise<ResourceCRUDResponse> {
    const params: Record<string, string> = {
      kind,
      resourceName,
    };

    if (!CLUSTER_SCOPED_RESOURCE_KINDS.has(kind)) {
      params.namespaceName = namespaceName;
    }

    const response = await this.apiFetch<{
      success: boolean;
      data?: ResourceCRUDResponse;
    }>(API_ENDPOINTS.PLATFORM_RESOURCE_DEFINITION, {
      method: 'PUT',
      params,
      body: { resource },
    });

    if (!response.data) {
      throw new Error(`Failed to update ${kind} ${resourceName}`);
    }

    return response.data;
  }

  async deleteResourceDefinition(
    kind: PlatformResourceKind,
    namespaceName: string,
    resourceName: string,
  ): Promise<ResourceCRUDResponse> {
    const params: Record<string, string> = {
      kind,
      resourceName,
    };

    if (!CLUSTER_SCOPED_RESOURCE_KINDS.has(kind)) {
      params.namespaceName = namespaceName;
    }

    const response = await this.apiFetch<{
      success: boolean;
      data?: ResourceCRUDResponse;
    }>(API_ENDPOINTS.PLATFORM_RESOURCE_DEFINITION, {
      method: 'DELETE',
      params,
    });

    if (!response.data) {
      throw new Error(`Failed to delete ${kind} ${resourceName}`);
    }

    return response.data;
  }
}
