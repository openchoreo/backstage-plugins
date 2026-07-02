import { createApiRef } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import type {
  WorkloadResource,
  ComponentRelease,
  ReleaseBindingCondition,
} from '@openchoreo/backstage-plugin-common';
import type { Environment } from '../components/RuntimeLogs/types';

// ============================================
// Response Types
// ============================================

/** Kubernetes Secret type supported by the create/update API */
export type SecretType =
  | 'Opaque'
  | 'kubernetes.io/basic-auth'
  | 'kubernetes.io/ssh-auth'
  | 'kubernetes.io/dockerconfigjson'
  | 'kubernetes.io/tls';

/** Kind of plane that hosts the secret data */
export type TargetPlaneKind =
  | 'WorkflowPlane'
  | 'ClusterWorkflowPlane'
  | 'DataPlane'
  | 'ClusterDataPlane';

/** Reference to the plane that hosts the secret data */
export interface TargetPlaneRef {
  kind: TargetPlaneKind;
  name: string;
}

/**
 * Secret resource. The list endpoint returns only `keys[]`; the single-secret
 * GET endpoint additionally populates `data` with base64-encoded values
 * (K8s Secret wire format). Decode at the UI boundary; treat as sensitive.
 */
export interface Secret {
  name: string;
  namespace: string;
  secretType?: SecretType;
  targetPlane?: TargetPlaneRef;
  /** Labels on the underlying SecretReference / K8s Secret. */
  labels?: Record<string, string>;
  /** Sorted list of keys present in the secret data */
  keys: string[];
  /**
   * Base64-encoded value map (K8s Secret wire format). Present only when
   * fetched via getSecret. Decode with `atob` (or equivalent) before display.
   */
  data?: Record<string, string>;
}

/** Secrets list response */
export interface SecretsListResponse {
  items: Secret[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Body for creating a new secret */
export interface CreateSecretRequest {
  secretName: string;
  secretType: SecretType;
  targetPlane: TargetPlaneRef;
  /** Required keys depend on secretType. */
  data: Record<string, string>;
  /** Labels applied to the underlying SecretReference. */
  labels?: Record<string, string>;
}

/** Body for updating an existing secret. Replaces all data; omitted keys are pruned. */
export interface UpdateSecretRequest {
  data: Record<string, string>;
  /** Labels applied to the underlying SecretReference. Replaces all user-set labels. */
  labels?: Record<string, string>;
}

/** Schema response containing component-type and trait environment override schemas */
export interface ComponentSchemaResponse {
  componentTypeEnvironmentConfigs?: {
    [key: string]: unknown;
  };
  traitEnvironmentConfigs?: {
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
  componentTypeEnvironmentConfigs?: unknown;
  traitEnvironmentConfigs?: unknown;
  workloadOverrides?: unknown;
  endpoints?: { url: string }[];
  status?: string;
  statusReason?: string;
  statusMessage?: string;
}

/** Release bindings response */
export interface ReleaseBindingsResponse {
  success: boolean;
  data?: {
    items: ReleaseBinding[];
  };
}

/** A single condition on a ResourceReleaseBinding. */
export interface ResourceReleaseBindingCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
  observedGeneration?: number;
}

/**
 * Resource release binding item — one per environment for a given Resource.
 * Fields the BFF transformer always emits (possibly as empty strings) are
 * required here; truly per-status fields are optional. Matches the
 * `ResourceReleaseBindingResponse` shape in `@openchoreo/backstage-plugin-common`.
 */
export interface ResourceReleaseBinding {
  name: string;
  environment: string;
  resourceName: string;
  projectName: string;
  namespaceName: string;
  releaseName: string;
  createdAt: string;
  retainPolicy?: 'Delete' | 'Retain';
  /**
   * Per-environment parameter overrides layered over
   * Resource.spec.parameters when manifests are rendered.
   */
  resourceTypeEnvironmentConfigs?: Record<string, unknown>;
  status?: 'Ready' | 'NotReady' | 'Failed';
  statusReason?: string;
  statusMessage?: string;
  conditions?: ResourceReleaseBindingCondition[];
}

/** Resource release bindings response */
export interface ResourceReleaseBindingsResponse {
  success: boolean;
  data?: {
    items: ResourceReleaseBinding[];
  };
}

/** Full ResourceRelease CR — used by the View release manifest modal */
export interface ResourceReleaseResponse {
  success: boolean;
  data?: Record<string, unknown>;
}

export interface ResourceBindingOutput {
  name: string;
  value?: string;
  secretKeyRef?: { name: string; key: string };
  configMapKeyRef?: { name: string; key: string };
}

/**
 * An output entry declared on a (Cluster)ResourceType. Same wire shape as
 * `ResourceBindingOutput` but semantically the template form: `value` may
 * carry an unresolved CEL expression and the secret/configmap refs name
 * a DP-side object that may not exist yet. The resource-dependency
 * editor uses this to render one row per declared output with the right
 * env/file binding controls (value-kind outputs can't be mounted as
 * files; the binding for them is env-only).
 */
export interface ResourceTypeOutput {
  name: string;
  value?: string;
  secretKeyRef?: { name: string; key: string };
  configMapKeyRef?: { name: string; key: string };
}

/**
 * Per-environment runtime view of a Resource. One entry per environment
 * defined in the project's deployment pipeline, including environments
 * with no binding (so the UI can render a Deploy affordance). Matches
 * the backend `ResourceEnvironment` shape in `plugins/openchoreo-backend/src/types.ts`.
 */
export interface ResourceEnvironment {
  uid?: string;
  name: string;
  resourceName?: string;
  dataPlaneRef?: string;
  dataPlaneKind?: 'DataPlane' | 'ClusterDataPlane';
  bindingName?: string;
  resourceRelease?: string;
  retainPolicy?: 'Delete' | 'Retain';
  status?: 'Ready' | 'NotReady' | 'Failed';
  statusReason?: string;
  statusMessage?: string;
  lastDeployed?: string;
  outputs?: ResourceBindingOutput[];
  promotionTargets?: {
    name: string;
    resourceName?: string;
  }[];
  latestRelease?: string;
}

/** A single condition on a ProjectReleaseBinding. */
export interface ProjectReleaseBindingCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
  observedGeneration?: number;
}

/**
 * Project release binding item — one per environment for a given Project.
 * Fields the BFF transformer always emits (possibly as empty strings) are
 * required here; truly per-status fields are optional. Matches the
 * `ProjectReleaseBindingResponse` shape in `@openchoreo/backstage-plugin-common`.
 */
export interface ProjectReleaseBinding {
  name: string;
  environment: string;
  projectName: string;
  namespaceName: string;
  releaseName: string;
  createdAt: string;
  /**
   * Per-environment overrides layered over the project-level parameters
   * when the (Cluster)ProjectType resources are rendered.
   */
  environmentConfigs?: Record<string, unknown>;
  /** Data-plane namespace owned by this binding (status.namespace). */
  namespace?: string;
  status?: 'Ready' | 'NotReady' | 'Failed';
  statusReason?: string;
  statusMessage?: string;
  conditions?: ProjectReleaseBindingCondition[];
}

/** Project release bindings response */
export interface ProjectReleaseBindingsResponse {
  success: boolean;
  data?: {
    items: ProjectReleaseBinding[];
  };
}

/**
 * Per-environment deploy view of a Project. One entry per environment defined
 * in the project's deployment pipeline, including environments with no binding
 * (so the UI can render a Deploy/Promote affordance). Matches the backend
 * `ProjectEnvironment` shape in `plugins/openchoreo-backend/src/types.ts`.
 */
export interface ProjectEnvironment {
  uid?: string;
  name: string;
  resourceName?: string;
  dataPlaneRef?: string;
  dataPlaneKind?: 'DataPlane' | 'ClusterDataPlane';
  bindingName?: string;
  /** The ProjectRelease pinned to this environment (binding.spec.projectRelease). */
  projectRelease?: string;
  status?: 'Ready' | 'NotReady' | 'Failed';
  statusReason?: string;
  statusMessage?: string;
  lastDeployed?: string;
  /** Data-plane namespace owned by this binding (binding.status.namespace). */
  namespace?: string;
  promotionTargets?: {
    name: string;
    resourceName?: string;
  }[];
  /** Latest ProjectRelease cut by the Project controller, if any. */
  latestRelease?: string;
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

/** Component release response */
export interface ComponentReleaseResponse {
  success: boolean;
  data?: ComponentRelease;
}

/** Component releases list response */
export interface ComponentReleasesResponse {
  success: boolean;
  data?: {
    items: ComponentRelease[];
  };
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

/** ABAC attribute available for CEL condition expressions on an action. */
export interface ConditionAttribute {
  /** Full dotted path of the attribute (e.g. "resource.environment"). */
  key: string;
  /** Human-readable description of the attribute. */
  description: string;
}

/** Authorization action with its scope in the resource hierarchy */
export interface ActionInfo {
  name: string;
  lowestScope: 'cluster' | 'namespace' | 'project' | 'component';
  /**
   * ABAC attributes available for CEL condition expressions on this action.
   * Empty / omitted means no conditions are supported.
   */
  conditions?: ConditionAttribute[];
}

/**
 * Action-scoped condition on a role mapping. Constrains only the listed
 * actions; multiple entries on the same mapping are OR-combined.
 */
export interface AuthzCondition {
  actions: string[];
  expression: string;
}

/** Cluster Role - cluster-wide role definition */
export interface ClusterRole {
  name: string;
  actions: string[];
  namespace?: string;
  description?: string;
  labels?: Record<string, string>;
}

/** Namespace Role - namespace-scoped role definition */
export interface NamespaceRole {
  name: string;
  namespace: string;
  actions: string[];
  description?: string;
  labels?: Record<string, string>;
}

/** Scope for cluster-scoped role mappings */
export interface ClusterRoleMappingScope {
  namespace?: string;
  project?: string;
  component?: string;
}

/** A single cluster role mapping (role + optional scope) */
export interface ClusterRoleMappingEntry {
  role: string;
  scope?: ClusterRoleMappingScope;
  /**
   * Per-mapping conditions that restrict specific actions granted by this role.
   * Multiple entries are OR-combined; only the listed actions are constrained.
   */
  conditions?: AuthzCondition[];
}

/** Cluster Role Binding - binds cluster roles to an entitlement */
export interface ClusterRoleBinding {
  name: string;
  roleMappings: ClusterRoleMappingEntry[];
  entitlement: Entitlement;
  effect: PolicyEffect;
  labels?: Record<string, string>;
}

/** Cluster Role Binding Request - request body for creating/updating cluster role bindings */
export interface ClusterRoleBindingRequest {
  name: string;
  roleMappings: ClusterRoleMappingEntry[];
  entitlement: {
    claim: string;
    value: string;
  };
  effect: PolicyEffect;
}

/** Scope for namespace-scoped role mappings */
export interface NamespaceRoleMappingScope {
  project?: string;
  component?: string;
}

/** A single namespace role mapping (role + optional scope) */
export interface NamespaceRoleMappingEntry {
  role: { name: string; namespace?: string };
  scope?: NamespaceRoleMappingScope;
  /**
   * Per-mapping conditions that restrict specific actions granted by this role.
   * Multiple entries are OR-combined; only the listed actions are constrained.
   */
  conditions?: AuthzCondition[];
}

/** Namespace Role Binding - response shape from the API */
export interface NamespaceRoleBinding {
  name: string;
  namespace: string;
  roleMappings: NamespaceRoleMappingEntry[];
  entitlement: Entitlement;
  effect: PolicyEffect;
  labels?: Record<string, string>;
}

/** Namespace Role Binding Request - body sent for create / update */
export interface NamespaceRoleBindingRequest {
  name: string;
  roleMappings: NamespaceRoleMappingEntry[];
  entitlement: {
    claim: string;
    value: string;
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

/** Component trait response */
export interface ComponentTrait {
  kind?: 'Trait' | 'ClusterTrait';
  name: string;
  instanceName: string;
  parameters?: Record<string, unknown>;
}

/** Platform resource kind for definition CRUD operations */
export type PlatformResourceKind =
  | 'projects'
  | 'namespaces'
  | 'componenttypes'
  | 'resourcetypes'
  | 'projecttypes'
  | 'resources'
  | 'traits'
  | 'workflows'
  | 'component-workflows'
  | 'components'
  | 'environments'
  | 'observabilityalertsnotificationchannels'
  | 'dataplanes'
  | 'workflowplanes'
  | 'observabilityplanes'
  | 'deploymentpipelines'
  | 'clustercomponenttypes'
  | 'clusterresourcetypes'
  | 'clusterprojecttypes'
  | 'clustertraits'
  | 'clusterworkflows'
  | 'clusterdataplanes'
  | 'clusterobservabilityplanes'
  | 'clusterworkflowplanes'
  | 'clusterworkflows';

/** Cluster-scoped resource kinds that don't require a namespace */
export const CLUSTER_SCOPED_RESOURCE_KINDS: ReadonlySet<PlatformResourceKind> =
  new Set([
    'clustercomponenttypes',
    'clusterresourcetypes',
    'clusterprojecttypes',
    'clustertraits',
    'clusterworkflows',
    'clusterdataplanes',
    'clusterobservabilityplanes',
    'clusterworkflowplanes',
    'clusterworkflows',
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

  /** Trigger a rolling restart of the binding's workloads via the openchoreo.dev/restartedAt annotation */
  rolloutRestartReleaseBinding(
    entity: Entity,
    bindingName: string,
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

  /** Fetch a specific component release (includes frozen workload spec) */
  fetchComponentRelease(
    entity: Entity,
    releaseName: string,
  ): Promise<ComponentReleaseResponse>;

  /** Fetch the schema for a component release (for overrides UI) */
  fetchComponentReleaseSchema(
    entity: Entity,
    releaseName: string,
  ): Promise<SchemaResponse>;

  /** Fetch all release bindings for a component */
  fetchReleaseBindings(entity: Entity): Promise<ReleaseBindingsResponse>;

  /**
   * Fetch a single ResourceRelease CR by name. Used by the Deploy tab's
   * View release manifest modal to render the frozen snapshot as YAML.
   */
  fetchResourceRelease(
    entity: Entity,
    releaseName: string,
  ): Promise<ResourceReleaseResponse>;

  /**
   * Fetch all resource release bindings for a Resource entity.
   * Filters by the entity's resource name and owning project, returning one
   * binding per environment.
   */
  fetchResourceReleaseBindings(
    entity: Entity,
  ): Promise<ResourceReleaseBindingsResponse>;

  /**
   * Fetch per-environment runtime info for a Resource entity. Returns one
   * entry per environment in the project's deployment pipeline (including
   * environments without bindings yet), joined with the Resource's latest
   * release.
   */
  fetchResourceEnvironmentInfo(entity: Entity): Promise<ResourceEnvironment[]>;

  /**
   * Create or update a ResourceReleaseBinding for the given environment.
   * Creates a new binding when none exists; otherwise advances
   * `spec.resourceRelease`. Optional fields are written when present, left
   * untouched when omitted.
   */
  updateResourceReleaseBinding(
    entity: Entity,
    environment: string,
    options: {
      resourceRelease: string;
      retainPolicy?: 'Delete' | 'Retain';
      resourceTypeEnvironmentConfigs?: unknown;
    },
  ): Promise<unknown>;

  /**
   * Delete a ResourceReleaseBinding for the given environment. With
   * `spec.retainPolicy=Retain` on the binding, the Resource controller's
   * finalizer holds the actual delete and DP-side state can persist.
   */
  deleteResourceReleaseBinding(
    entity: Entity,
    environment: string,
  ): Promise<unknown>;

  /**
   * Fetch per-environment deploy info for a Project entity. Returns one entry
   * per environment in the project's deployment pipeline (including
   * environments without bindings yet), joined with the project's latest
   * release.
   */
  fetchProjectEnvironmentInfo(entity: Entity): Promise<ProjectEnvironment[]>;

  /**
   * Fetch all project release bindings for a Project entity. Filters by the
   * owning project, returning one binding per environment.
   */
  fetchProjectReleaseBindings(
    entity: Entity,
  ): Promise<ProjectReleaseBindingsResponse>;

  /**
   * Create or update a ProjectReleaseBinding for the given environment.
   * Creates a new binding when none exists; otherwise advances
   * `spec.projectRelease` (the deploy/promote pin). `environmentConfigs` is
   * written when present, left untouched when omitted.
   */
  updateProjectReleaseBinding(
    entity: Entity,
    environment: string,
    options: {
      projectRelease: string;
      environmentConfigs?: unknown;
    },
  ): Promise<unknown>;

  /**
   * Fetch a schema section from the frozen snapshot stored on a
   * ProjectRelease. `parameters` returns the project-level schema;
   * `environmentConfigs` returns the per-env override schema. Pinned-release
   * flows use this so form validation matches what the release was actually
   * cut against, not the live (Cluster)ProjectType which may have drifted.
   */
  fetchProjectReleaseSchema(
    namespaceName: string,
    releaseName: string,
    section: 'parameters' | 'environmentConfigs',
  ): Promise<{ success: boolean; data?: Record<string, unknown> }>;

  /** List all component releases for a component (sorted newest first by caller) */
  listComponentReleases(entity: Entity): Promise<ComponentReleasesResponse>;

  /** Create or update a release binding for deploy/promote actions */
  updateReleaseBinding(
    entity: Entity,
    environment: string,
    releaseName: string,
    componentTypeEnvironmentConfigs?: unknown,
    traitEnvironmentConfigs?: unknown,
    workloadOverrides?: any,
  ): Promise<any>;

  /** Patch release binding overrides */
  patchReleaseBindingOverrides(
    entity: Entity,
    environment: string,
    componentTypeEnvironmentConfigs?: unknown,
    traitEnvironmentConfigs?: unknown,
    workloadOverrides?: any,
    releaseName?: string,
  ): Promise<any>;

  /** Fetch resource tree for a specific release binding */
  fetchResourceTree(
    namespaceName: string,
    releaseBindingName: string,
  ): Promise<any>;

  /** Fetch Kubernetes events for a specific resource */
  fetchResourceEvents(
    namespaceName: string,
    releaseBindingName: string,
    resourceParams: {
      group: string;
      version: string;
      kind: string;
      name: string;
    },
  ): Promise<ResourceEventsResponse>;

  /** Fetch pod logs for a specific pod resource */
  fetchPodLogs(
    namespaceName: string,
    releaseBindingName: string,
    params: {
      podName: string;
      sinceSeconds?: number;
    },
  ): Promise<PodLogsResponse>;

  // === Workload Operations ===

  /** Fetch full workload K8s resource for an entity */
  fetchWorkloadInfo(entity: Entity): Promise<WorkloadResource>;

  /** Apply full workload resource (create or update) */
  applyWorkload(
    entity: Entity,
    workload: WorkloadResource,
    isNew: boolean,
  ): Promise<WorkloadResource>;

  // === Workflow Operations ===

  /** Fetch workflow schema */
  fetchWorkflowSchema(
    namespaceName: string,
    workflowName: string,
  ): Promise<WorkflowSchemaResponse>;

  /** Update component workflow parameters */
  updateComponentWorkflowParameters(
    entity: Entity,
    parameters: Record<string, unknown> | null,
  ): Promise<any>;

  // === Component & Environment Info ===

  /** Get component details (including UID, deletionTimestamp, parameters, and
   *  the controller's Ready-condition error state). */
  getComponentDetails(entity: Entity): Promise<{
    uid?: string;
    deletionTimestamp?: string;
    parameters?: Record<string, unknown>;
    autoDeploy?: boolean;
    latestRelease?: { name?: string; releaseHash?: string };
    conditions?: ReleaseBindingCondition[];
    hasError?: boolean;
    errorReason?: string;
    errorMessage?: string;
  }>;

  /** Get project details (including UID and deletionTimestamp) */
  getProjectDetails(
    entity: Entity,
  ): Promise<{ uid?: string; deletionTimestamp?: string }>;

  /** Get list of environments for a component */
  getEnvironments(entity: Entity): Promise<Environment[]>;

  /** Fetch builds for a component */
  fetchBuilds(
    componentName: string,
    projectName: string,
    namespaceName: string,
  ): Promise<any[]>;

  // === Other ===

  /** Fetch cell diagram info for a project */
  getCellDiagramInfo(
    entity: Entity,
    options?: {
      environmentName?: string;
      startTime?: string;
      endTime?: string;
    },
  ): Promise<any>;

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

  /** Update the deployment pipeline reference on a project */
  updateProjectPipeline(
    namespaceName: string,
    projectName: string,
    deploymentPipelineName: string,
  ): Promise<void>;

  // === Traits Operations ===

  /** Fetch all traits attached to a component */
  fetchComponentTraits(entity: Entity): Promise<ComponentTrait[]>;

  /** Update all traits on a component (replaces existing traits) */
  updateComponentTraits(
    entity: Entity,
    traits: ComponentTrait[],
  ): Promise<ComponentTrait[]>;

  /** Fetch the input parameter schema for a component type */
  fetchComponentTypeSchema(
    entity: Entity,
  ): Promise<{ success: boolean; data?: Record<string, unknown> }>;

  /**
   * Fetch the input parameter schema for a Resource's (Cluster)ResourceType.
   * Reads RESOURCE_TYPE + RESOURCE_TYPE_KIND annotations off the Resource
   * entity to pick the right endpoint.
   */
  fetchResourceTypeSchema(
    entity: Entity,
  ): Promise<{ success: boolean; data?: Record<string, unknown> }>;

  /**
   * Fetch the declared outputs[] for a Resource's (Cluster)ResourceType.
   * Reads RESOURCE_TYPE + RESOURCE_TYPE_KIND annotations off the Resource
   * entity to pick the right endpoint. Consumed by the resource-dependency
   * editor to render one row per output with the right env/file binding
   * controls. Each output has a name and exactly one of value /
   * secretKeyRef / configMapKeyRef set.
   */
  fetchResourceTypeOutputs(
    entity: Entity,
  ): Promise<{ success: boolean; data?: ResourceTypeOutput[] }>;

  /**
   * Fetch a schema section from the frozen snapshot stored on a
   * ResourceRelease. `parameters` returns the developer schema; `environmentConfigs`
   * returns the per-env override schema. Pinned-release flows use this so
   * form validation matches what the release was actually cut against,
   * not the live (Cluster)ResourceType which may have drifted.
   */
  fetchResourceReleaseSchema(
    namespaceName: string,
    releaseName: string,
    section: 'parameters' | 'environmentConfigs',
  ): Promise<{ success: boolean; data?: Record<string, unknown> }>;

  /** Update component config (traits and/or parameters) in a single call */
  updateComponentConfig(
    entity: Entity,
    traits?: ComponentTrait[],
    parameters?: Record<string, unknown>,
  ): Promise<any>;

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

  /** Fetch available cluster-scoped traits */
  fetchClusterTraits(): Promise<any>;

  /** Fetch schema for a cluster-scoped trait */
  fetchClusterTraitSchema(clusterTraitName: string): Promise<any>;

  // === Authorization Operations ===

  /** List all available actions */
  listActions(): Promise<ActionInfo[]>;

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

  // === Secrets Operations ===

  /** List secrets for a namespace */
  listSecrets(namespaceName: string): Promise<SecretsListResponse>;

  /** Get a single secret by name */
  getSecret(namespaceName: string, secretName: string): Promise<Secret>;

  /** Create a new secret */
  createSecret(
    namespaceName: string,
    request: CreateSecretRequest,
  ): Promise<Secret>;

  /** Update (replace data of) an existing secret */
  updateSecret(
    namespaceName: string,
    secretName: string,
    request: UpdateSecretRequest,
  ): Promise<Secret>;

  /** Delete a secret */
  deleteSecret(namespaceName: string, secretName: string): Promise<void>;

  // === Entity Delete Operations ===

  /** Delete a component */
  deleteComponent(entity: Entity): Promise<void>;

  /** Delete a project */
  deleteProject(entity: Entity): Promise<void>;

  /** Delete a namespace */
  deleteNamespace(entity: Entity): Promise<void>;

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

  // === Component Exec ===

  /**
   * Creates a short-lived exec session. The returned sessionId can be used to
   * open a WebSocket connection at /api/openchoreo/exec/ws?sessionId=<id>
   * within the next 30 seconds.
   *
   * podName/containerName target a specific pod and container (e.g. when
   * launched from a Pod node in the K8s resource tree). When omitted, the
   * control plane resolves the pod for the component + environment.
   */
  execInit(params: {
    namespaceName: string;
    projectName: string;
    componentName: string;
    environment: string;
    podName?: string;
    containerName?: string;
  }): Promise<{ sessionId: string; ttlSeconds: number }>;

  /** List all bindings for a namespace role */
  listBindingsForNamespaceRole(
    namespace: string,
    name: string,
  ): Promise<RoleBindingsLookup>;
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
