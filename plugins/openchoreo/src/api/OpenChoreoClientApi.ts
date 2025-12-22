import { createApiRef } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import type {
  ModelsWorkload,
  ModelsBuild,
  RuntimeLogsResponse,
} from '@openchoreo/backstage-plugin-common';
import type {
  LogsResponse,
  RuntimeLogsParams,
  Environment,
} from '../components/RuntimeLogs/types';

// ============================================
// Response Types
// ============================================

/** Schema response containing component-type and trait environment override schemas */
export interface ComponentSchemaResponse {
  componentTypeEnvOverrides?: {
    [key: string]: unknown;
  };
  traitOverrides?: {
    [key: string]: {
      [key: string]: unknown;
    };
  };
}

/** Release binding item */
export interface ReleaseBinding {
  name: string;
  environment: string;
  componentTypeEnvOverrides?: unknown;
  traitOverrides?: unknown;
  workloadOverrides?: unknown;
  status?: string;
}

/** Release bindings response */
export interface ReleaseBindingsResponse {
  success: boolean;
  data?: {
    items: ReleaseBinding[];
  };
}

/** Create release response */
export interface CreateReleaseResponse {
  success: boolean;
  data?: {
    name: string;
  };
}

/** Schema fetch response */
export interface SchemaResponse {
  success: boolean;
  message: string;
  data?: ComponentSchemaResponse;
}

/** Workflow schema response */
export interface WorkflowSchemaResponse {
  success: boolean;
  data?: unknown;
}

/** Component info for dashboard */
export interface ComponentInfo {
  orgName: string;
  projectName: string;
  componentName: string;
}

/** Secret reference */
export interface SecretReference {
  name: string;
  namespace: string;
  displayName?: string;
  description?: string;
  data?: SecretDataSourceInfo[];
  createdAt: string;
  status: string;
}

export interface SecretDataSourceInfo {
  secretKey: string;
  remoteRef: {
    key: string;
  };
}

export interface SecretReferencesResponse {
  success: boolean;
  data: {
    items: SecretReference[];
  };
}

/** Authorization types */
export interface AuthzRole {
  name: string;
  actions: string[];
}

export interface Entitlement {
  claim: string;
  value: string;
}

export interface ResourceHierarchy {
  organization?: string;
  organization_units?: string[];
  project?: string;
  component?: string;
}

export type PolicyEffect = 'allow' | 'deny';

export interface RoleEntitlementMapping {
  id?: number;
  role_name: string;
  entitlement: Entitlement;
  hierarchy: ResourceHierarchy;
  effect: PolicyEffect;
  context?: Record<string, unknown>;
}

/** Filters for listing role mappings */
export interface RoleMappingFilters {
  role?: string;
  claim?: string;
  value?: string;
}

export interface EntitlementConfig {
  Claim: string;
  DisplayName: string;
}

export interface AuthMechanismConfig {
  Type: string;
  Entitlement: EntitlementConfig;
}

export type SubjectType = 'user' | 'service_account';

export interface UserTypeConfig {
  Type: SubjectType;
  DisplayName: string;
  Priority: number;
  AuthMechanisms: AuthMechanismConfig[];
}

/** Organization summary for listing */
export interface OrganizationSummary {
  name: string;
  displayName?: string;
}

/** Project summary for listing */
export interface ProjectSummary {
  name: string;
  displayName?: string;
}

/** Component summary for listing */
export interface ComponentSummary {
  name: string;
  displayName?: string;
}

/** Build logs params */
export interface BuildLogsParams {
  componentName: string;
  projectName: string;
  orgName: string;
  buildId: string;
  buildUuid: string;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

/** Component trait response */
export interface ComponentTrait {
  name: string;
  instanceName: string;
  parameters?: Record<string, unknown>;
}

// ============================================
// OpenChoreo Client API Interface
// ============================================

/**
 * OpenChoreo Client API - provides all OpenChoreo backend operations.
 *
 * Usage:
 * ```typescript
 * const client = useApi(openChoreoClientApiRef);
 * const environments = await client.fetchEnvironmentInfo(entity);
 * ```
 */
export interface OpenChoreoClientApi {
  // === Environment Operations ===

  /** Fetch environment deployment info for an entity */
  fetchEnvironmentInfo(entity: Entity): Promise<any>;

  /** Promote a deployment from one environment to another */
  promoteToEnvironment(
    entity: Entity,
    sourceEnvironment: string,
    targetEnvironment: string,
  ): Promise<any>;

  /** Delete a release binding (undeploy from environment) */
  deleteReleaseBinding(entity: Entity, environment: string): Promise<any>;

  /** Update component binding state (Active/Suspend/Undeploy) */
  updateComponentBinding(
    entity: Entity,
    bindingName: string,
    releaseState: 'Active' | 'Suspend' | 'Undeploy',
  ): Promise<any>;

  /** Patch component settings (e.g., autoDeploy) */
  patchComponent(entity: Entity, autoDeploy: boolean): Promise<any>;

  /** Create a new component release */
  createComponentRelease(
    entity: Entity,
    releaseName?: string,
  ): Promise<CreateReleaseResponse>;

  /** Deploy a release to its target environment */
  deployRelease(entity: Entity, releaseName: string): Promise<any>;

  /** Fetch the schema for a component release (for overrides UI) */
  fetchComponentReleaseSchema(
    entity: Entity,
    releaseName: string,
  ): Promise<SchemaResponse>;

  /** Fetch all release bindings for a component */
  fetchReleaseBindings(entity: Entity): Promise<ReleaseBindingsResponse>;

  /** Patch release binding overrides */
  patchReleaseBindingOverrides(
    entity: Entity,
    environment: string,
    componentTypeEnvOverrides?: unknown,
    traitOverrides?: unknown,
    workloadOverrides?: any,
    releaseName?: string,
  ): Promise<any>;

  /** Fetch release data for a specific environment */
  fetchEnvironmentRelease(
    entity: Entity,
    environmentName: string,
  ): Promise<any>;

  // === Workload Operations ===

  /** Fetch workload configuration for an entity */
  fetchWorkloadInfo(entity: Entity): Promise<ModelsWorkload>;

  /** Apply workload configuration changes */
  applyWorkload(entity: Entity, workloadSpec: ModelsWorkload): Promise<any>;

  // === Workflow Operations ===

  /** Fetch workflow schema */
  fetchWorkflowSchema(
    organizationName: string,
    workflowName: string,
  ): Promise<WorkflowSchemaResponse>;

  /** Update component workflow parameters */
  updateComponentWorkflowParameters(
    entity: Entity,
    systemParameters: Record<string, unknown> | null,
    parameters: Record<string, unknown> | null,
  ): Promise<any>;

  // === Runtime Logs ===

  /** Get component details (including UID) */
  getComponentDetails(entity: Entity): Promise<{ uid?: string }>;

  /** Fetch runtime logs for a component */
  getRuntimeLogs(
    entity: Entity,
    params: RuntimeLogsParams,
  ): Promise<LogsResponse>;

  /** Get list of environments for runtime logs */
  getEnvironments(entity: Entity): Promise<Environment[]>;

  // === Build Logs ===

  /** Fetch build logs */
  getBuildLogs(params: BuildLogsParams): Promise<RuntimeLogsResponse>;

  /** Fetch build logs for a specific build */
  fetchBuildLogsForBuild(build: ModelsBuild): Promise<RuntimeLogsResponse>;

  /** Fetch builds for a component */
  fetchBuilds(
    componentName: string,
    projectName: string,
    organizationName: string,
  ): Promise<any[]>;

  // === Other ===

  /** Fetch cell diagram info for a project */
  getCellDiagramInfo(entity: Entity): Promise<any>;

  /** Fetch total bindings count for dashboard */
  fetchTotalBindingsCount(components: ComponentInfo[]): Promise<number>;

  /** Fetch secret references for an organization */
  fetchSecretReferences(entity: Entity): Promise<SecretReferencesResponse>;

  /** Fetch deployment pipeline for a project */
  fetchDeploymentPipeline(
    projectName: string,
    organizationName: string,
  ): Promise<any>;

  // === Traits Operations ===

  /** Fetch all traits attached to a component */
  fetchComponentTraits(entity: Entity): Promise<ComponentTrait[]>;

  /** Update all traits on a component (replaces existing traits) */
  updateComponentTraits(
    entity: Entity,
    traits: ComponentTrait[],
  ): Promise<ComponentTrait[]>;

  // === Authorization Operations ===

  /** List all roles */
  listRoles(): Promise<AuthzRole[]>;

  /** Get a specific role */
  getRole(name: string): Promise<AuthzRole>;

  /** Create a new role */
  addRole(role: AuthzRole): Promise<AuthzRole>;

  /** Update an existing role's actions */
  updateRole(name: string, actions: string[]): Promise<AuthzRole>;

  /** Delete a role. Use force=true to delete even if role has mappings */
  deleteRole(name: string, force?: boolean): Promise<void>;

  /** List role mappings with optional filters */
  listRoleMappings(
    filters?: RoleMappingFilters,
  ): Promise<RoleEntitlementMapping[]>;

  /** Get all role mappings for a specific role */
  getRoleMappingsForRole(roleName: string): Promise<RoleEntitlementMapping[]>;

  /** Create a new role mapping */
  addRoleMapping(
    mapping: RoleEntitlementMapping,
  ): Promise<RoleEntitlementMapping>;

  /** Update an existing role mapping */
  updateRoleMapping(
    mappingId: number,
    mapping: RoleEntitlementMapping,
  ): Promise<RoleEntitlementMapping>;

  /** Delete a role mapping by ID */
  deleteRoleMapping(mappingId: number): Promise<void>;

  /** List all available actions */
  listActions(): Promise<string[]>;

  /** List all user types */
  listUserTypes(): Promise<UserTypeConfig[]>;

  // === Hierarchy Data Operations ===

  /** List all organizations */
  listOrganizations(): Promise<OrganizationSummary[]>;

  /** List projects for an organization */
  listProjects(orgName: string): Promise<ProjectSummary[]>;

  /** List components for a project */
  listComponents(
    orgName: string,
    projectName: string,
  ): Promise<ComponentSummary[]>;
}

// ============================================
// API Reference
// ============================================

/**
 * ApiRef for the OpenChoreo client.
 *
 * Usage:
 * ```typescript
 * import { openChoreoClientApiRef } from '@openchoreo/backstage-plugin';
 *
 * const client = useApi(openChoreoClientApiRef);
 * ```
 */
export const openChoreoClientApiRef = createApiRef<OpenChoreoClientApi>({
  id: 'plugin.openchoreo.client',
});
