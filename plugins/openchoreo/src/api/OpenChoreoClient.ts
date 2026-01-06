import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  ModelsWorkload,
  ModelsBuild,
  RuntimeLogsResponse,
} from '@openchoreo/backstage-plugin-common';
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
  AuthzRole,
  RoleEntitlementMapping,
  RoleMappingFilters,
  UserTypeConfig,
  OrganizationSummary,
  ProjectSummary,
  ComponentSummary,
} from './OpenChoreoClientApi';
import type {
  LogsResponse,
  RuntimeLogsParams,
  Environment,
} from '../components/RuntimeLogs/types';

// ============================================
// API Endpoints
// ============================================

const API_ENDPOINTS = {
  ENVIRONMENT_INFO: '/deploy',
  PROMOTE_DEPLOYMENT: '/promote-deployment',
  DELETE_RELEASE_BINDING: '/delete-release-binding',
  CELL_DIAGRAM: '/cell-diagram',
  RUNTIME_LOGS: '/logs/component',
  DEPLOYEMNT_WORKLOAD: '/workload',
  UPDATE_BINDING: '/update-binding',
  DASHBOARD_BINDINGS_COUNT: '/dashboard/bindings-count',
  CREATE_RELEASE: '/create-release',
  DEPLOY_RELEASE: '/deploy-release',
  COMPONENT_RELEASE_SCHEMA: '/component-release-schema',
  RELEASE_BINDINGS: '/release-bindings',
  PATCH_RELEASE_BINDING: '/patch-release-binding',
  ENVIRONMENT_RELEASE: '/environment-release',
  WORKFLOW_SCHEMA: '/workflow-schema',
  COMPONENT_WORKFLOW_PARAMETERS: '/workflow-parameters',
  SECRET_REFERENCES: '/secret-references',
  COMPONENT: '/component',
  BUILD_LOGS: '/build-logs',
  DEPLOYMENT_PIPELINE: '/deployment-pipeline',
  BUILDS: '/builds',
  COMPONENT_TRAITS: '/component-traits',
  // Authorization endpoints
  AUTHZ_ROLES: '/authz/roles',
  AUTHZ_ROLE_MAPPINGS: '/authz/role-mappings',
  AUTHZ_ACTIONS: '/authz/actions',
  // Configuration endpoints
  USER_TYPES: '/user-types',
  // Hierarchy data endpoints
  ORGANIZATIONS: '/orgs',
  PROJECTS: '/projects', // GET /orgs/{orgName}/projects
  COMPONENTS: '/components', // GET /orgs/{orgName}/projects/{projectName}/components
} as const;

// ============================================
// Entity Metadata Utilities
// ============================================

interface EntityMetadata {
  component: string;
  project: string;
  organization: string;
}

function extractEntityMetadata(entity: Entity): EntityMetadata {
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  if (!component || !project || !organization) {
    throw new Error(
      'Missing required OpenChoreo annotations in entity. ' +
        `Required: ${CHOREO_ANNOTATIONS.COMPONENT}, ${CHOREO_ANNOTATIONS.PROJECT}, ${CHOREO_ANNOTATIONS.ORGANIZATION}`,
    );
  }

  return { component, project, organization };
}

function tryExtractEntityMetadata(entity: Entity): EntityMetadata | null {
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  if (!component || !project || !organization) {
    return null;
  }

  return { component, project, organization };
}

function entityMetadataToParams(
  metadata: EntityMetadata,
): Record<string, string> {
  return {
    componentName: metadata.component,
    projectName: metadata.project,
    organizationName: metadata.organization,
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

  private async apiFetchRaw(
    endpoint: string,
    options?: {
      method?: HttpMethod;
      body?: unknown;
      params?: Record<string, string>;
    },
  ): Promise<Response> {
    const baseUrl = await this.discovery.getBaseUrl('openchoreo');
    const url = new URL(`${baseUrl}${endpoint}`);

    if (options?.params) {
      url.search = new URLSearchParams(options.params).toString();
    }

    const headers: HeadersInit = {};

    if (options?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return this.fetchApi.fetch(url.toString(), {
      method: options?.method || 'GET',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body:
        options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
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
    const { component, project, organization } = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.PROMOTE_DEPLOYMENT, {
      method: 'POST',
      body: {
        sourceEnv: sourceEnvironment,
        targetEnv: targetEnvironment,
        componentName: component,
        projectName: project,
        orgName: organization,
      },
    });
  }

  async deleteReleaseBinding(
    entity: Entity,
    environment: string,
  ): Promise<any> {
    const { component, project, organization } = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.DELETE_RELEASE_BINDING, {
      method: 'DELETE',
      body: {
        orgName: organization,
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
    const { component, project, organization } = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.UPDATE_BINDING, {
      method: 'PATCH',
      body: {
        orgName: organization,
        projectName: project,
        componentName: component,
        bindingName,
        releaseState,
      },
    });
  }

  async patchComponent(entity: Entity, autoDeploy: boolean): Promise<any> {
    const { component, project, organization } = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.COMPONENT, {
      method: 'PATCH',
      body: {
        organizationName: organization,
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
    const { component, project, organization } = extractEntityMetadata(entity);

    const patchReq: Record<string, unknown> = {
      orgName: organization,
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
    organizationName: string,
    workflowName: string,
  ): Promise<WorkflowSchemaResponse> {
    return this.apiFetch<WorkflowSchemaResponse>(
      API_ENDPOINTS.WORKFLOW_SCHEMA,
      {
        params: {
          organizationName,
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

  async getComponentDetails(entity: Entity): Promise<{ uid?: string }> {
    const metadata = extractEntityMetadata(entity);

    return this.apiFetch(API_ENDPOINTS.COMPONENT, {
      params: entityMetadataToParams(metadata),
    });
  }

  async getRuntimeLogs(
    entity: Entity,
    params: RuntimeLogsParams,
  ): Promise<LogsResponse> {
    const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
    const organization =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

    const queryParams: Record<string, string> = {};
    if (project && organization) {
      queryParams.orgName = organization;
      queryParams.projectName = project;
    }

    const response = await this.apiFetchRaw(
      `${API_ENDPOINTS.RUNTIME_LOGS}/${params.componentName}`,
      {
        method: 'POST',
        params: queryParams,
        body: {
          componentId: params.componentId,
          componentName: params.componentName,
          environmentId: params.environmentId,
          environmentName: params.environmentName,
          logLevels: params.logLevels,
          startTime: params.startTime,
          endTime: params.endTime,
          limit: params.limit,
          offset: params.offset,
        },
      },
    );

    const data = await response.json();

    // Check if observability is disabled
    if (response.ok && data.message === 'observability is disabled') {
      throw new Error('Observability is not enabled for this component');
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch runtime logs: ${response.status} ${response.statusText}`,
      );
    }

    return data;
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
          orgName: params.orgName,
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
      !build.orgName
    ) {
      throw new Error(
        'Component name, Build ID, UUID, Project name, or Organization name not available',
      );
    }

    return this.getBuildLogs({
      componentName: build.componentName,
      buildId: build.name,
      buildUuid: build.uuid,
      projectName: build.projectName,
      orgName: build.orgName,
      limit: 100,
      sortOrder: 'desc',
    });
  }

  async fetchBuilds(
    componentName: string,
    projectName: string,
    organizationName: string,
  ): Promise<any[]> {
    try {
      return await this.apiFetch<any[]>(API_ENDPOINTS.BUILDS, {
        params: {
          componentName,
          projectName,
          organizationName,
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
    const organization =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

    if (!project || !organization) {
      return [];
    }

    return this.apiFetch(API_ENDPOINTS.CELL_DIAGRAM, {
      params: {
        projectName: project,
        organizationName: organization,
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
    const organizationName =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

    if (!organizationName) {
      throw new Error('Missing organization annotation');
    }

    return this.apiFetch<SecretReferencesResponse>(
      API_ENDPOINTS.SECRET_REFERENCES,
      {
        params: { organizationName },
      },
    );
  }

  async fetchDeploymentPipeline(
    projectName: string,
    organizationName: string,
  ): Promise<any> {
    return this.apiFetch(API_ENDPOINTS.DEPLOYMENT_PIPELINE, {
      params: {
        projectName,
        organizationName,
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
        organizationName: metadata.organization,
        projectName: metadata.project,
        componentName: metadata.component,
        traits,
      },
    });
  }

  // ============================================
  // Authorization Operations
  // ============================================

  async listRoles(): Promise<AuthzRole[]> {
    const response = await this.apiFetch<{ data: AuthzRole[] }>(
      API_ENDPOINTS.AUTHZ_ROLES,
    );
    return response.data || [];
  }

  async getRole(name: string): Promise<AuthzRole> {
    const response = await this.apiFetch<{ data: AuthzRole }>(
      `${API_ENDPOINTS.AUTHZ_ROLES}/${encodeURIComponent(name)}`,
    );
    return response.data;
  }

  async addRole(role: AuthzRole): Promise<AuthzRole> {
    const response = await this.apiFetch<{ data: AuthzRole }>(
      API_ENDPOINTS.AUTHZ_ROLES,
      {
        method: 'POST',
        body: role,
      },
    );
    return response.data;
  }

  async updateRole(name: string, actions: string[]): Promise<AuthzRole> {
    const response = await this.apiFetch<{ data: AuthzRole }>(
      `${API_ENDPOINTS.AUTHZ_ROLES}/${encodeURIComponent(name)}`,
      {
        method: 'PUT',
        body: { actions },
      },
    );
    return response.data;
  }

  async deleteRole(name: string, force?: boolean): Promise<void> {
    const queryString = force ? '?force=true' : '';
    await this.apiFetch(
      `${API_ENDPOINTS.AUTHZ_ROLES}/${encodeURIComponent(name)}${queryString}`,
      {
        method: 'DELETE',
      },
    );
  }

  async listRoleMappings(
    filters?: RoleMappingFilters,
  ): Promise<RoleEntitlementMapping[]> {
    const params = new URLSearchParams();
    if (filters?.role) {
      params.set('role', filters.role);
    }
    if (filters?.claim && filters?.value) {
      params.set('claim', filters.claim);
      params.set('value', filters.value);
    }
    const queryString = params.toString();
    const url = queryString
      ? `${API_ENDPOINTS.AUTHZ_ROLE_MAPPINGS}?${queryString}`
      : API_ENDPOINTS.AUTHZ_ROLE_MAPPINGS;

    const response = await this.apiFetch<{ data: RoleEntitlementMapping[] }>(
      url,
    );
    return response.data || [];
  }

  async getRoleMappingsForRole(
    roleName: string,
  ): Promise<RoleEntitlementMapping[]> {
    return this.listRoleMappings({ role: roleName });
  }

  async addRoleMapping(
    mapping: RoleEntitlementMapping,
  ): Promise<RoleEntitlementMapping> {
    const response = await this.apiFetch<{ data: RoleEntitlementMapping }>(
      API_ENDPOINTS.AUTHZ_ROLE_MAPPINGS,
      {
        method: 'POST',
        body: mapping,
      },
    );
    return response.data;
  }

  async updateRoleMapping(
    mappingId: number,
    mapping: RoleEntitlementMapping,
  ): Promise<RoleEntitlementMapping> {
    const response = await this.apiFetch<{ data: RoleEntitlementMapping }>(
      `${API_ENDPOINTS.AUTHZ_ROLE_MAPPINGS}/${mappingId}`,
      {
        method: 'PUT',
        body: mapping,
      },
    );
    return response.data;
  }

  async deleteRoleMapping(mapping: RoleEntitlementMapping): Promise<void> {
    await this.apiFetch(API_ENDPOINTS.AUTHZ_ROLE_MAPPINGS, {
      method: 'DELETE',
      body: mapping,
    });
  }

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

  async listOrganizations(): Promise<OrganizationSummary[]> {
    const response = await this.apiFetch<{ data: OrganizationSummary[] }>(
      API_ENDPOINTS.ORGANIZATIONS,
    );
    return response.data || [];
  }

  async listProjects(orgName: string): Promise<ProjectSummary[]> {
    const response = await this.apiFetch<{ data: ProjectSummary[] }>(
      `/orgs/${encodeURIComponent(orgName)}/projects`,
    );
    return response.data || [];
  }

  async listComponents(
    orgName: string,
    projectName: string,
  ): Promise<ComponentSummary[]> {
    const response = await this.apiFetch<{ data: ComponentSummary[] }>(
      `/orgs/${encodeURIComponent(orgName)}/projects/${encodeURIComponent(
        projectName,
      )}/components`,
    );
    return response.data || [];
  }
}
