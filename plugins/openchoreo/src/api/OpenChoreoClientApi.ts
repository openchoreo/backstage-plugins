import { createApiRef } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import type {
  ModelsWorkload,
  ModelsBuild,
  RuntimeLogsResponse,
} from '@openchoreo/backstage-plugin-common';
import type { Environment } from '../components/RuntimeLogs/types';

// ============================================
// Response Types
// ============================================

/** Git secret item */
export interface GitSecret {
  name: string;
  namespace: string;
}

/** Git secrets list response */
export interface GitSecretsListResponse {
  items: GitSecret[];
  totalCount: number;
  page: number;
  pageSize: number;
}

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
  releaseName?: string;
  componentTypeEnvOverrides?: unknown;
  traitOverrides?: unknown;
  workloadOverrides?: unknown;
  endpoints?: { url: string }[];
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
  namespaceName: string;
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
export interface Entitlement {
  claim: string;
  value: string;
}

export type PolicyEffect = 'allow' | 'deny';

// ============================================
// Cluster & Namespace Scoped Authorization Types
// ============================================

/** Cluster Role - cluster-wide role definition */
export interface ClusterRole {
  name: string;
  actions: string[];
  namespace?: string;
  description?: string;
}

/** Namespace Role - namespace-scoped role definition */
export interface NamespaceRole {
  name: string;
  namespace: string;
  actions: string[];
  description?: string;
}

/** Cluster Role Binding - binds a cluster role to an entitlement */
export interface ClusterRoleBinding {
  name: string;
  role: { name: string };
  entitlement: Entitlement;
  effect: PolicyEffect;
}

/** Cluster Role Binding Request - request body for creating/updating cluster role bindings */
export interface ClusterRoleBindingRequest {
  name: string;
  role: string;
  entitlement: {
    claim: string;
    value: string;
  };
  effect: PolicyEffect;
}

/** Namespace Role Binding - response shape from the API */
export interface NamespaceRoleBinding {
  name: string;
  namespace: string;
  role: { name: string; namespace?: string };
  entitlement: Entitlement;
  hierarchy?: {
    namespace?: string;
    project?: string;
    component?: string;
  };
  effect: PolicyEffect;
}

/** Namespace Role Binding Request - body sent for create / update */
export interface NamespaceRoleBindingRequest {
  name: string;
  role: { name: string; namespace: string };
  entitlement: {
    claim: string;
    value: string;
  };
  targetPath?: {
    project?: string;
    component?: string;
  };
  effect: PolicyEffect;
}

/** Filters for listing cluster role bindings */
export interface ClusterRoleBindingFilters {
  roleName?: string;
  claim?: string;
  value?: string;
  effect?: PolicyEffect;
}

/** Filters for listing namespace role bindings */
export interface NamespaceRoleBindingFilters extends ClusterRoleBindingFilters {
  roleNamespace?: string;
}

export interface EntitlementConfig {
  claim: string;
  displayName: string;
}

export interface AuthMechanismConfig {
  type: string;
  entitlement: EntitlementConfig;
}

export type SubjectType = 'user' | 'service_account';

export interface UserTypeConfig {
  type: SubjectType;
  displayName: string;
  priority: number;
  authMechanisms: AuthMechanismConfig[];
}

/** Result of a force-delete operation */
export interface ForceDeleteResult {
  deletedBindings: string[];
  failedBindings: { name: string; error: string }[];
  roleDeleted: boolean;
}

/** Bindings lookup result for a role */
export interface RoleBindingsLookup {
  clusterRoleBindings: ClusterRoleBinding[];
  namespaceRoleBindings: (NamespaceRoleBinding & { namespace: string })[];
}

/** Namespace summary for listing */
export interface NamespaceSummary {
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
  namespaceName: string;
  buildId: string;
  buildUuid: string;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

/** Component trait response */
export interface ComponentTrait {
  kind?: 'Trait' | 'ClusterTrait';
  name: string;
  instanceName: string;
  parameters?: Record<string, unknown>;
}

/** Platform resource kind for definition CRUD operations */
export type PlatformResourceKind =
  | 'componenttypes'
  | 'traits'
  | 'workflows'
  | 'component-workflows'
  | 'environments'
  | 'dataplanes'
  | 'buildplanes'
  | 'observabilityplanes'
  | 'deploymentpipelines'
  | 'clustercomponenttypes'
  | 'clustertraits'
  | 'clusterdataplanes'
  | 'clusterobservabilityplanes'
  | 'clusterbuildplanes';

/** Cluster-scoped resource kinds that don't require a namespace */
export const CLUSTER_SCOPED_RESOURCE_KINDS: ReadonlySet<PlatformResourceKind> =
  new Set([
    'clustercomponenttypes',
    'clustertraits',
    'clusterdataplanes',
    'clusterobservabilityplanes',
    'clusterbuildplanes',
  ]);

/** Response for resource CRUD operations */
export interface ResourceCRUDResponse {
  operation: string;
  name?: string;
  kind?: string;
}

/** Kubernetes event from resource events API */
export interface ResourceEvent {
  type: string;
  reason: string;
  message: string;
  count?: number;
  firstTimestamp: string;
  lastTimestamp: string;
  source: string;
}

/** Response from the resource events API */
export interface ResourceEventsResponse {
  events: ResourceEvent[];
}

/** Pod log entry from the pod-logs API */
export interface PodLogEntry {
  timestamp: string;
  log: string;
}

/** Response from the pod-logs API */
export interface PodLogsResponse {
  logEntries: PodLogEntry[];
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

  /** Fetch resource tree for a specific environment */
  fetchResourceTree(entity: Entity, environmentName: string): Promise<any>;

  /** Fetch Kubernetes events for a specific resource */
  fetchResourceEvents(
    entity: Entity,
    environmentName: string,
    resourceParams: {
      kind: string;
      name: string;
      namespace?: string;
      uid?: string;
    },
  ): Promise<ResourceEventsResponse>;

  /** Fetch pod logs for a specific pod resource */
  fetchPodLogs(
    entity: Entity,
    environmentName: string,
    params: {
      name: string;
      namespace?: string;
      container?: string;
      sinceSeconds?: number;
    },
  ): Promise<PodLogsResponse>;

  // === Workload Operations ===

  /** Fetch workload configuration for an entity */
  fetchWorkloadInfo(entity: Entity): Promise<ModelsWorkload>;

  /** Apply workload configuration changes */
  applyWorkload(entity: Entity, workloadSpec: ModelsWorkload): Promise<any>;

  // === Workflow Operations ===

  /** Fetch workflow schema */
  fetchWorkflowSchema(
    namespaceName: string,
    workflowName: string,
  ): Promise<WorkflowSchemaResponse>;

  /** Update component workflow parameters */
  updateComponentWorkflowParameters(
    entity: Entity,
    systemParameters: Record<string, unknown> | null,
    parameters: Record<string, unknown> | null,
  ): Promise<any>;

  // === Component & Environment Info ===

  /** Get component details (including UID and deletionTimestamp) */
  getComponentDetails(
    entity: Entity,
  ): Promise<{ uid?: string; deletionTimestamp?: string }>;

  /** Get project details (including UID and deletionTimestamp) */
  getProjectDetails(
    entity: Entity,
  ): Promise<{ uid?: string; deletionTimestamp?: string }>;

  /** Get list of environments for a component */
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
    namespaceName: string,
  ): Promise<any[]>;

  // === Other ===

  /** Fetch cell diagram info for a project */
  getCellDiagramInfo(entity: Entity): Promise<any>;

  /** Fetch total bindings count for dashboard */
  fetchTotalBindingsCount(components: ComponentInfo[]): Promise<number>;

  /** Fetch secret references for a namespace (entity-based) */
  fetchSecretReferences(entity: Entity): Promise<SecretReferencesResponse>;

  /** Fetch secret references by namespace name directly */
  fetchSecretReferencesByNamespace(
    namespaceName: string,
  ): Promise<SecretReferencesResponse>;

  /** Fetch deployment pipeline for a project */
  fetchDeploymentPipeline(
    projectName: string,
    namespaceName: string,
  ): Promise<any>;

  // === Traits Operations ===

  /** Fetch all traits attached to a component */
  fetchComponentTraits(entity: Entity): Promise<ComponentTrait[]>;

  /** Update all traits on a component (replaces existing traits) */
  updateComponentTraits(
    entity: Entity,
    traits: ComponentTrait[],
  ): Promise<ComponentTrait[]>;

  /** Fetch available traits for a namespace (no entity required) */
  fetchTraitsByNamespace(
    namespaceName: string,
    page?: number,
    pageSize?: number,
  ): Promise<any>;

  /** Fetch trait schema by namespace name and trait name (no entity required) */
  fetchTraitSchemaByNamespace(
    namespaceName: string,
    traitName: string,
  ): Promise<any>;

  // === Authorization Operations ===

  /** List all available actions */
  listActions(): Promise<string[]>;

  /** List all user types */
  listUserTypes(): Promise<UserTypeConfig[]>;

  // === Hierarchy Data Operations ===

  /** List all namespaces */
  listNamespaces(): Promise<NamespaceSummary[]>;

  /** List projects for a namespace */
  listProjects(namespaceName: string): Promise<ProjectSummary[]>;

  /** List components for a project */
  listComponents(
    namespaceName: string,
    projectName: string,
  ): Promise<ComponentSummary[]>;

  // === DataPlane Operations ===

  /** Fetch data plane details */
  fetchDataPlaneDetails(
    namespaceName: string,
    dataplaneName: string,
  ): Promise<any>;

  // === Git Secrets Operations ===

  /** List git secrets for a namespace */
  listGitSecrets(namespaceName: string): Promise<GitSecretsListResponse>;

  /** Create a new git secret */
  createGitSecret(
    namespaceName: string,
    secretName: string,
    secretType: 'basic-auth' | 'ssh-auth',
    tokenOrKey: string,
    username?: string,
    sshKeyId?: string,
  ): Promise<GitSecret>;

  /** Delete a git secret */
  deleteGitSecret(namespaceName: string, secretName: string): Promise<void>;

  // === Entity Delete Operations ===

  /** Delete a component */
  deleteComponent(entity: Entity): Promise<void>;

  /** Delete a project */
  deleteProject(entity: Entity): Promise<void>;

  // === Custom Annotation Operations ===

  /** Fetch custom annotations for an entity */
  fetchEntityAnnotations(entity: Entity): Promise<Record<string, string>>;

  /** Update custom annotations on an entity. Use null value to delete a key. */
  updateEntityAnnotations(
    entity: Entity,
    annotations: Record<string, string | null>,
  ): Promise<Record<string, string>>;

  // === Platform Resource Definition Operations ===

  /**
   * Get the full CRD definition for a platform resource
   * @param kind - Resource kind (componenttypes, traits, workflows, component-workflows)
   * @param namespaceName - Kubernetes namespace
   * @param resourceName - Name of the resource
   * @returns The full CRD as an unstructured JSON object
   */
  getResourceDefinition(
    kind: PlatformResourceKind,
    namespaceName: string,
    resourceName: string,
  ): Promise<Record<string, unknown>>;

  /**
   * Update (or create) a platform resource definition
   * @param kind - Resource kind (componenttypes, traits, workflows, component-workflows)
   * @param namespaceName - Kubernetes namespace
   * @param resourceName - Name of the resource
   * @param resource - Full CRD as JSON
   * @returns Operation result
   */
  updateResourceDefinition(
    kind: PlatformResourceKind,
    namespaceName: string,
    resourceName: string,
    resource: Record<string, unknown>,
  ): Promise<ResourceCRUDResponse>;

  /**
   * Delete a platform resource definition
   * @param kind - Resource kind (componenttypes, traits, workflows, component-workflows)
   * @param namespaceName - Kubernetes namespace
   * @param resourceName - Name of the resource
   * @returns Operation result
   */
  deleteResourceDefinition(
    kind: PlatformResourceKind,
    namespaceName: string,
    resourceName: string,
  ): Promise<ResourceCRUDResponse>;
  // === Cluster Roles Operations ===

  /** List all cluster roles */
  listClusterRoles(): Promise<ClusterRole[]>;

  /** Get a specific cluster role */
  getClusterRole(name: string): Promise<ClusterRole>;

  /** Create a new cluster role */
  createClusterRole(role: ClusterRole): Promise<ClusterRole>;

  /** Update an existing cluster role */
  updateClusterRole(
    name: string,
    role: Partial<ClusterRole>,
  ): Promise<ClusterRole>;

  /** Delete a cluster role */
  deleteClusterRole(name: string): Promise<void>;

  // === Namespace Roles Operations ===

  /** List all namespace roles for a namespace */
  listNamespaceRoles(namespace: string): Promise<NamespaceRole[]>;

  /** Get a specific namespace role */
  getNamespaceRole(namespace: string, name: string): Promise<NamespaceRole>;

  /** Create a new namespace role */
  createNamespaceRole(role: NamespaceRole): Promise<NamespaceRole>;

  /** Update an existing namespace role */
  updateNamespaceRole(
    namespace: string,
    name: string,
    role: Partial<NamespaceRole>,
  ): Promise<NamespaceRole>;

  /** Delete a namespace role */
  deleteNamespaceRole(namespace: string, name: string): Promise<void>;

  // === Cluster Role Bindings Operations ===

  /** List all cluster role bindings */
  listClusterRoleBindings(
    filters?: ClusterRoleBindingFilters,
  ): Promise<ClusterRoleBinding[]>;

  /** Get a specific cluster role binding */
  getClusterRoleBinding(name: string): Promise<ClusterRoleBinding>;

  /** Create a new cluster role binding */
  createClusterRoleBinding(
    binding: ClusterRoleBindingRequest,
  ): Promise<ClusterRoleBinding>;

  /** Update an existing cluster role binding */
  updateClusterRoleBinding(
    name: string,
    binding: Partial<ClusterRoleBindingRequest>,
  ): Promise<ClusterRoleBinding>;

  /** Delete a cluster role binding */
  deleteClusterRoleBinding(name: string): Promise<void>;

  // === Namespace Role Bindings Operations ===

  /** List all namespace role bindings for a namespace */
  listNamespaceRoleBindings(
    namespace: string,
    filters?: NamespaceRoleBindingFilters,
  ): Promise<NamespaceRoleBinding[]>;

  /** Get a specific namespace role binding */
  getNamespaceRoleBinding(
    namespace: string,
    name: string,
  ): Promise<NamespaceRoleBinding>;

  /** Create a new namespace role binding */
  createNamespaceRoleBinding(
    namespace: string,
    binding: NamespaceRoleBindingRequest,
  ): Promise<NamespaceRoleBinding>;

  /** Update an existing namespace role binding */
  updateNamespaceRoleBinding(
    namespace: string,
    name: string,
    binding: NamespaceRoleBindingRequest,
  ): Promise<NamespaceRoleBinding>;

  /** Delete a namespace role binding */
  deleteNamespaceRoleBinding(namespace: string, name: string): Promise<void>;

  // === Binding Lookup & Force-Delete Operations ===

  /** List all bindings (cluster + namespace) for a cluster role */
  listBindingsForClusterRole(name: string): Promise<RoleBindingsLookup>;

  /** List all bindings for a namespace role */
  listBindingsForNamespaceRole(
    namespace: string,
    name: string,
  ): Promise<RoleBindingsLookup>;

  /** Force-delete a cluster role (delete bindings first, then the role) */
  forceDeleteClusterRole(name: string): Promise<ForceDeleteResult>;

  /** Force-delete a namespace role (delete bindings first, then the role) */
  forceDeleteNamespaceRole(
    namespace: string,
    name: string,
  ): Promise<ForceDeleteResult>;
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
