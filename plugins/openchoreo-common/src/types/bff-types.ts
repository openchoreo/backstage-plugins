/*
 * Hand-written BFF response & request types.
 *
 * These interfaces were extracted from the auto-generated OpenChoreo legacy
 * OpenAPI types (`OpenChoreoLegacyComponents['schemas'][…]`) so that plugins
 * are decoupled from the generated client package.
 *
 * ⚠ Keep shapes in sync with the OpenChoreo API — do NOT edit field
 *   names / optionality without a matching backend change.
 */

// ---------------------------------------------------------------------------
// Core response wrappers
// ---------------------------------------------------------------------------

export interface APIResponse {
  success?: boolean;
  data?: {
    [key: string]: unknown;
  };
  error?: string;
  code?: string;
}

export interface ListResponse {
  items?: {
    [key: string]: unknown;
  }[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Namespace
// ---------------------------------------------------------------------------

export interface NamespaceResponse {
  name: string;
  displayName?: string;
  description?: string;
  /** Format: date-time */
  createdAt: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Project & deployment pipeline
// ---------------------------------------------------------------------------

export interface ProjectResponse {
  uid: string;
  name: string;
  namespaceName: string;
  displayName?: string;
  description?: string;
  deploymentPipeline?: string;
  /** Format: date-time */
  createdAt: string;
  status?: string;
  /**
   * Format: date-time
   * @description Timestamp when the project was marked for deletion
   */
  deletionTimestamp?: string;
}

export interface DeploymentPipelineResponse {
  name: string;
  displayName?: string;
  description?: string;
  namespaceName: string;
  /** Format: date-time */
  createdAt: string;
  status?: string;
  promotionPaths?: PromotionPath[];
}

export interface PromotionPath {
  sourceEnvironmentRef: string;
  targetEnvironmentRefs: TargetEnvironmentRef[];
}

export interface TargetEnvironmentRef {
  name: string;
  requiresApproval?: boolean;
  isManualApprovalRequired?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ComponentResponse {
  uid: string;
  name: string;
  displayName?: string;
  description?: string;
  type: string;
  componentType?: ComponentTypeRef;
  projectName: string;
  namespaceName: string;
  /** Format: date-time */
  createdAt: string;
  /**
   * Format: date-time
   * @description Timestamp when the component was marked for deletion
   */
  deletionTimestamp?: string | null;
  status?: string;
  autoDeploy?: boolean;
  service?: {
    [key: string]: unknown;
  };
  webApplication?: {
    [key: string]: unknown;
  };
  scheduledTask?: {
    [key: string]: unknown;
  };
  api?: {
    [key: string]: unknown;
  };
  workload?: {
    [key: string]: unknown;
  };
  componentWorkflow?: ComponentWorkflow;
}

export interface ComponentTypeRef {
  kind?: string;
  name: string;
}

export interface ComponentTypeResponse {
  name: string;
  displayName?: string;
  description?: string;
  workloadType: string;
  allowedWorkflows?: string[];
  allowedTraits?: AllowedTraitResponse[];
  /** Format: date-time */
  createdAt: string;
}

export interface AllowedTraitResponse {
  kind?: string;
  name: string;
}

export interface PatchComponentRequest {
  /** @description Controls whether the component should automatically deploy to the default environment */
  autoDeploy?: boolean;
}

// ---------------------------------------------------------------------------
// Component workflow
// ---------------------------------------------------------------------------

export interface ComponentWorkflow {
  name: string;
  systemParameters: ComponentWorkflowSystemParams;
  /** @description Developer-defined workflow parameters as arbitrary JSON */
  parameters?: {
    [key: string]: unknown;
  };
}

export type ComponentWorkflowSystemParams = {
  repository: ComponentWorkflowRepository;
};

export type ComponentWorkflowRepository = {
  url: string;
  revision: ComponentWorkflowRepositoryRevision;
  appPath: string;
};

export type ComponentWorkflowRepositoryRevision = {
  branch: string;
  commit?: string;
};

// ---------------------------------------------------------------------------
// Component traits
// ---------------------------------------------------------------------------

export interface ComponentTraitResponse {
  /** @description Kind of trait resource (Trait or ClusterTrait) */
  kind?: 'Trait' | 'ClusterTrait';
  /** @description Name of the Trait resource */
  name: string;
  /** @description Unique instance name for this trait within the component */
  instanceName: string;
  /** @description Trait parameter values */
  parameters?: {
    [key: string]: unknown;
  };
}

export interface ComponentTraitRequest {
  /** @description Kind of trait resource (Trait or ClusterTrait) */
  kind?: 'Trait' | 'ClusterTrait';
  /** @description Name of the Trait resource to use */
  name: string;
  /** @description Unique instance name for this trait within the component */
  instanceName: string;
  /** @description Trait parameter values */
  parameters?: {
    [key: string]: unknown;
  };
}

export interface UpdateComponentTraitsRequest {
  /** @description Array of trait instances to attach to the component (replaces all existing traits) */
  traits: ComponentTraitRequest[];
}

export interface TraitResponse {
  name: string;
  displayName?: string;
  description?: string;
  /** Format: date-time */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Cluster-scoped component types
// ---------------------------------------------------------------------------

export interface ClusterComponentTypeResponse {
  name: string;
  displayName?: string;
  description?: string;
  workloadType: string;
  allowedWorkflows?: string[];
  allowedTraits?: AllowedTraitResponse[];
  /** Format: date-time */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Cluster-scoped traits
// ---------------------------------------------------------------------------

export interface ClusterTraitResponse {
  name: string;
  displayName?: string;
  description?: string;
  /** Format: date-time */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Workflow & build
// ---------------------------------------------------------------------------

export interface WorkflowResponse {
  name: string;
  displayName?: string;
  description?: string;
  /** Format: date-time */
  createdAt?: string;
}

export interface ComponentWorkflowRunResponse {
  name: string;
  uuid: string;
  componentName: string;
  projectName: string;
  namespaceName: string;
  commit?: string;
  status?: string;
  /** Format: date-time */
  createdAt?: string;
  image?: string;
  workflow?: ComponentWorkflowConfigResponse;
}

export interface ComponentWorkflowConfigResponse {
  name: string;
  systemParameters?: SystemParametersResponse;
  /** @description Developer-defined workflow parameters as arbitrary JSON */
  parameters?: {
    [key: string]: unknown;
  };
}

export interface SystemParametersResponse {
  repository?: RepositoryResponse;
}

export interface RepositoryResponse {
  url: string;
  appPath: string;
  revision?: RepositoryRevisionResponse;
}

export interface RepositoryRevisionResponse {
  branch: string;
  commit?: string;
}

/** @description Status response for a component workflow run */
export interface ComponentWorkflowRunStatusResponse {
  /**
   * @description Overall workflow status
   * @example Running
   * @enum {string}
   */
  status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Succeeded';
  /** @description Array of step-level statuses */
  steps: WorkflowStepStatus[];
  /**
   * @description Whether the workflow run has live observability (logs/events are available via openchoreo-api).
   *     - If workflow run is recent (< TTL), returns true
   *     - If workflow run is older than TTL, returns false
   *     - This field is used to determine whether the workflow run logs/events should be fetched from openchoreo-api or observer-api.
   */
  hasLiveObservability: boolean;
}

/** @description Status of an individual workflow step */
export interface WorkflowStepStatus {
  /**
   * @description Step name or template name
   * @example build-step
   */
  name: string;
  /**
   * @description Step execution phase
   * @example Succeeded
   * @enum {string}
   */
  phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Skipped' | 'Error';
  /**
   * Format: date-time
   * @description Timestamp when the step started (null if not started)
   * @example 2025-01-06T10:00:00Z
   */
  startedAt?: string | null;
  /**
   * Format: date-time
   * @description Timestamp when the step finished (null if not finished)
   * @example 2025-01-06T10:05:00Z
   */
  finishedAt?: string | null;
}

/** @description A single log entry from a component workflow run */
export interface ComponentWorkflowRunLogEntry {
  /**
   * Format: date-time
   * @description Timestamp when the log entry was generated (RFC3339 format)
   * @example 2025-01-06T10:00:00.123Z
   */
  timestamp?: string;
  /**
   * @description The log message content
   * @example Building application...
   */
  log: string;
}

/** @description A single Kubernetes event entry from a component workflow run */
export interface ComponentWorkflowRunEventEntry {
  /**
   * Format: date-time
   * @description Timestamp when the event was recorded (RFC3339 format)
   * @example 2025-01-06T10:00:00Z
   */
  timestamp: string;
  /**
   * @description Event type (e.g., Normal, Warning)
   * @example Warning
   */
  type: string;
  /**
   * @description Short, machine-understandable reason for the event
   * @example BackOff
   */
  reason: string;
  /**
   * @description Human-readable description of the event
   * @example Back-off restarting failed container
   */
  message: string;
}

export interface BuildResponse {
  name: string;
  uuid: string;
  componentName: string;
  projectName: string;
  namespaceName: string;
  commit?: string;
  status?: string;
  /** Format: date-time */
  createdAt: string;
  image?: string;
  parameters?: Record<string, any>;
}

export interface BuildTemplateResponse {
  name: string;
  parameters?: BuildTemplateParameter[];
  /** Format: date-time */
  createdAt: string;
}

export interface BuildTemplateParameter {
  name: string;
  default?: string;
}

// ---------------------------------------------------------------------------
// Environment & data plane
// ---------------------------------------------------------------------------

export interface DataPlaneRef {
  kind?: string;
  name?: string;
}

export interface EnvironmentResponse {
  uid: string;
  name: string;
  namespace: string;
  displayName?: string;
  description?: string;
  dataPlaneRef?: DataPlaneRef;
  isProduction: boolean;
  dnsPrefix?: string;
  /** Format: date-time */
  createdAt: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Infrastructure planes
// ---------------------------------------------------------------------------

export interface AgentConnectionStatusResponse {
  connected?: boolean;
  connectedAgents?: number;
  /** Format: date-time */
  lastConnectedTime?: string;
  /** Format: date-time */
  lastDisconnectedTime?: string;
  /** Format: date-time */
  lastHeartbeatTime?: string;
  message?: string;
}

export interface DataPlaneResponse {
  name: string;
  namespace: string;
  displayName?: string;
  description?: string;
  imagePullSecretRefs?: string[];
  secretStoreRef?: string;
  publicVirtualHost: string;
  namespaceVirtualHost: string;
  /** Format: int32 */
  publicHTTPPort: number;
  /** Format: int32 */
  publicHTTPSPort: number;
  /** Format: int32 */
  namespaceHTTPPort: number;
  /** Format: int32 */
  namespaceHTTPSPort: number;
  observabilityPlaneRef?: string;
  agentConnection?: AgentConnectionStatusResponse;
  /** Format: date-time */
  createdAt: string;
  status?: string;
}

export interface ClusterDataPlaneResponse {
  name: string;
  displayName?: string;
  description?: string;
  imagePullSecretRefs?: string[];
  secretStoreRef?: string;
  publicVirtualHost: string;
  namespaceVirtualHost: string;
  /** Format: int32 */
  publicHTTPPort: number;
  /** Format: int32 */
  publicHTTPSPort: number;
  /** Format: int32 */
  namespaceHTTPPort: number;
  /** Format: int32 */
  namespaceHTTPSPort: number;
  observabilityPlaneRef?: string;
  agentConnection?: AgentConnectionStatusResponse;
  /** Format: date-time */
  createdAt: string;
  status?: string;
}

export interface BuildPlaneResponse {
  name: string;
  namespace: string;
  displayName?: string;
  description?: string;
  observabilityPlaneRef?: string;
  agentConnection?: AgentConnectionStatusResponse;
  /** Format: date-time */
  createdAt: string;
  status?: string;
}

export interface ObservabilityPlaneResponse {
  name: string;
  namespace: string;
  displayName?: string;
  description?: string;
  observerURL?: string;
  agentConnection?: AgentConnectionStatusResponse;
  /** Format: date-time */
  createdAt: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Release binding & deployment
// ---------------------------------------------------------------------------

export interface ReleaseBindingResponse {
  name: string;
  componentName: string;
  projectName: string;
  namespaceName: string;
  environment: string;
  releaseName: string;
  componentTypeEnvOverrides?: {
    [key: string]: unknown;
  };
  traitOverrides?: {
    [key: string]: unknown;
  };
  workloadOverrides?: WorkloadOverrides;
  /** Format: date-time */
  createdAt: string;
  status?: string;
}

export interface WorkloadOverrides {
  container?: ContainerOverride;
}

export interface ContainerOverride {
  env?: EnvVar[];
  files?: FileVar[];
}

export interface ComponentReleaseResponse {
  name: string;
  componentName: string;
  projectName: string;
  namespaceName: string;
  /** Format: date-time */
  createdAt: string;
  status?: string;
}

/** @description Wrapped schema containing component-type and trait environment override schemas */
export interface ComponentSchemaResponse {
  /** @description JSON Schema for component-type environment overrides */
  componentTypeEnvOverrides?: {
    [key: string]: unknown;
  };
  /** @description Object mapping trait instance names to their JSON Schemas for environment overrides */
  traitOverrides?: {
    [key: string]: {
      [key: string]: unknown;
    };
  };
}

// ---------------------------------------------------------------------------
// Binding (environment deployment status)
// ---------------------------------------------------------------------------

export interface BindingResponse {
  name: string;
  type: string;
  componentName: string;
  projectName: string;
  namespaceName: string;
  environment: string;
  status: BindingStatus;
  serviceBinding?: ServiceBinding;
  webApplicationBinding?: WebApplicationBinding;
  scheduledTaskBinding?: ScheduledTaskBinding;
}

export interface BindingStatus {
  reason: string;
  message: string;
  /** @enum {string} */
  status: 'InProgress' | 'Active' | 'Failed' | 'Suspended' | 'NotYetDeployed';
  /** Format: date-time */
  lastTransitioned: string;
}

export interface ServiceBinding {
  endpoints?: EndpointStatus[];
  image?: string;
  releaseState?: string;
}

export interface WebApplicationBinding {
  endpoints?: EndpointStatus[];
  image?: string;
  releaseState?: string;
}

export interface ScheduledTaskBinding {
  image?: string;
  releaseState?: string;
}

export interface EndpointStatus {
  name: string;
  type: string;
  project?: ExposedEndpoint;
  namespace?: ExposedEndpoint;
  public?: ExposedEndpoint;
}

export interface ExposedEndpoint {
  host: string;
  port: number;
  scheme?: string;
  basePath?: string;
  uri?: string;
}

// ---------------------------------------------------------------------------
// Workload
// ---------------------------------------------------------------------------

/** @description The workload type determines how the workload is deployed */
export type WorkloadType =
  | 'Service'
  | 'ManualTask'
  | 'ScheduledTask'
  | 'WebApplication';

export interface WorkloadResponse {
  name?: string;
  /**
   * @description The workload type determines how the workload is deployed
   * @enum {string}
   */
  type?: WorkloadType;
  owner?: WorkloadOwner;
  metadata?: {
    [key: string]: unknown;
  };
  spec?: {
    [key: string]: unknown;
  };
  container?: Container;
  endpoints?: {
    [key: string]: WorkloadEndpoint;
  };
  connections?: {
    [key: string]: Connection;
  };
}

export interface Container {
  image: string;
  command?: string[];
  args?: string[];
  env?: EnvVar[];
}

export interface EnvVar {
  key: string;
  value?: string;
  valueFrom?: EnvVarValueFrom;
}

export interface FileVar {
  key: string;
  mountPath: string;
  value?: string;
  valueFrom?: EnvVarValueFrom;
}

export interface EnvVarValueFrom {
  secretRef?: SecretKeyRef;
}

export interface SecretKeyRef {
  name: string;
  key: string;
}

export interface WorkloadEndpoint {
  /** @description Access scope for the endpoint. */
  visibility?: ('project' | 'namespace' | 'internal' | 'external')[];
  /** @enum {string} */
  type: 'TCP' | 'UDP' | 'HTTP' | 'REST' | 'gRPC' | 'Websocket' | 'GraphQL';
  port: number;
  schema?: Schema;
}

export interface Connection {
  inject?: ConnectionInject;
  params: ConnectionParams;
  type: string;
}

export interface ConnectionParams {
  componentName: string;
  endpoint: string;
  projectName: string;
}

export interface ConnectionInject {
  env?: ConnectionInjectEnv[];
}

export interface ConnectionInjectEnv {
  name: string;
  value: string;
}

export interface WorkloadOwner {
  projectName: string;
  componentName: string;
}

export interface Schema {
  type?: string;
  content?: string;
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

export interface SecretReferenceResponse {
  name: string;
  namespace: string;
  displayName?: string;
  description?: string;
  secretStores?: SecretStoreReference[];
  /** @description Duration string for refresh interval (e.g., "5m", "1h") */
  refreshInterval?: string;
  data?: SecretDataSourceInfo[];
  /** Format: date-time */
  createdAt: string;
  /** Format: date-time */
  lastRefreshTime?: string;
  status: string;
}

export interface SecretStoreReference {
  name: string;
  namespace: string;
  kind: string;
}

export interface SecretDataSourceInfo {
  secretKey: string;
  remoteRef: RemoteReferenceInfo;
}

export interface RemoteReferenceInfo {
  key: string;
  property?: string;
  version?: string;
}

export interface GitSecretResponse {
  /** @description Name of the git secret */
  name: string;
  /** @description Namespace the secret belongs to */
  namespace: string;
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

/** @enum {string} */
export type SubjectType = 'user' | 'service_account';

export type UserCapabilitiesResponse = {
  user?: SubjectContext;
  capabilities?: {
    [key: string]: ActionCapability;
  };
  /** Format: date-time */
  evaluatedAt?: string;
};

export type SubjectContext = {
  Type?: SubjectType;
  EntitlementClaim?: string;
  EntitlementValues?: string[];
};

export type ActionCapability = {
  allowed?: CapabilityResource[];
  denied?: CapabilityResource[];
};

export type CapabilityResource = {
  path: string;
  constraints?: Record<string, never>;
};

// ---------------------------------------------------------------------------
// Release (environment release)
// ---------------------------------------------------------------------------

export interface ReleaseResponse {
  spec: ReleaseSpec;
  status: ReleaseStatus;
}

export interface ReleaseSpec {
  owner: ReleaseOwner;
  environmentName: string;
  resources?: Resource[];
  /** @description Watch interval for release resources when stable (default 5m) */
  interval?: string;
  /** @description Watch interval for release resources when transitioning (default 10s) */
  progressingInterval?: string;
}

export interface ReleaseStatus {
  resources?: ResourceStatus[];
  conditions?: Condition[];
}

export interface ReleaseOwner {
  projectName: string;
  componentName: string;
}

export interface Resource {
  /** @description Unique identifier for the resource */
  id: string;
  /** @description Complete Kubernetes resource definition */
  object: {
    [key: string]: unknown;
  };
}

export interface ResourceStatus {
  id: string;
  /** @description API group of the resource (empty for core resources) */
  group?: string;
  version: string;
  kind: string;
  name: string;
  /** @description Namespace (empty for cluster-scoped resources) */
  namespace?: string;
  /** @description Entire .status field of the resource */
  status?: {
    [key: string]: unknown;
  };
  /** @enum {string} */
  healthStatus?:
    | 'Unknown'
    | 'Progressing'
    | 'Healthy'
    | 'Suspended'
    | 'Degraded';
  /** Format: date-time */
  lastObservedTime?: string;
}

export interface Condition {
  type: string;
  /** @enum {string} */
  status: 'True' | 'False' | 'Unknown';
  /** Format: int64 */
  observedGeneration?: number;
  /** Format: date-time */
  lastTransitionTime: string;
  reason?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Request types used by services
// ---------------------------------------------------------------------------

export interface PromoteComponentRequest {
  sourceEnv: string;
  targetEnv: string;
}

export interface DeployReleaseRequest {
  releaseName: string;
}

export interface PatchReleaseBindingRequest {
  releaseName?: string;
  environment?: string;
  componentTypeEnvOverrides?: {
    [key: string]: unknown;
  };
  traitOverrides?: {
    [key: string]: unknown;
  };
  workloadOverrides?: WorkloadOverrides;
}

export interface CreateComponentReleaseRequest {
  releaseName?: string;
}
