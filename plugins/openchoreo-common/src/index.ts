export {
  CHOREO_ANNOTATIONS,
  CHOREO_LABELS,
  RELATION_PROMOTES_TO,
  RELATION_PROMOTED_BY,
  RELATION_USES_PIPELINE,
  RELATION_PIPELINE_USED_BY,
  RELATION_HOSTED_ON,
  RELATION_HOSTS,
  RELATION_OBSERVED_BY,
  RELATION_OBSERVES,
  RELATION_INSTANCE_OF,
  RELATION_HAS_INSTANCE,
  RELATION_USES_WORKFLOW,
  RELATION_WORKFLOW_USED_BY,
  RELATION_BUILDS_ON,
  RELATION_BUILDS,
} from './constants';

// Permissions
export {
  OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
  OPENCHOREO_RESOURCE_TYPE_PROJECT,
  openchoreoComponentCreatePermission,
  openchoreoComponentReadPermission,
  openchoreoComponentBuildPermission,
  openchoreoComponentViewBuildsPermission,
  openchoreoComponentDeployPermission,
  openchoreoComponentUpdatePermission,
  openchoreoProjectCreatePermission,
  openchoreoProjectReadPermission,
  openchoreoNamespaceReadPermission,
  openchoreoNamespaceCreatePermission,
  openchoreoEnvironmentCreatePermission,
  openchoreoEnvironmentReadPermission,
  openchoreoReleaseCreatePermission,
  openchoreoReleaseReadPermission,
  openchoreoReleaseBindingReadPermission,
  openchoreoRoleViewPermission,
  openchoreoRoleCreatePermission,
  openchoreoRoleUpdatePermission,
  openchoreoRoleDeletePermission,
  openchoreoClusterRoleViewPermission,
  openchoreoClusterRoleCreatePermission,
  openchoreoClusterRoleUpdatePermission,
  openchoreoClusterRoleDeletePermission,
  openchoreoRoleMappingViewPermission,
  openchoreoRoleMappingCreatePermission,
  openchoreoRoleMappingUpdatePermission,
  openchoreoRoleMappingDeletePermission,
  openchoreoClusterRoleMappingViewPermission,
  openchoreoClusterRoleMappingCreatePermission,
  openchoreoClusterRoleMappingUpdatePermission,
  openchoreoClusterRoleMappingDeletePermission,
  openchoreoLogsViewPermission,
  openchoreoMetricsViewPermission,
  openchoreoTracesViewPermission,
  openchoreoRcaViewPermission,
  openchoreoTraitsViewPermission,
  openchoreoTraitCreatePermission,
  openchoreoComponentTypeCreatePermission,
  openchoreoClusterComponentTypeCreatePermission,
  openchoreoClusterTraitCreatePermission,
  openchoreoWorkflowCreatePermission,
  openchoreoClusterWorkflowCreatePermission,
  openchoreoComponentWorkflowCreatePermission,
  openchoreoComponentTypeUpdatePermission,
  openchoreoComponentTypeDeletePermission,
  openchoreoTraitUpdatePermission,
  openchoreoTraitDeletePermission,
  openchoreoWorkflowUpdatePermission,
  openchoreoWorkflowDeletePermission,
  openchoreoComponentWorkflowUpdatePermission,
  openchoreoComponentWorkflowDeletePermission,
  openchoreoEnvironmentUpdatePermission,
  openchoreoEnvironmentDeletePermission,
  openchoreoDataplaneUpdatePermission,
  openchoreoDataplaneDeletePermission,
  openchoreoWorkflowplaneUpdatePermission,
  openchoreoWorkflowplaneDeletePermission,
  openchoreoObservabilityplaneUpdatePermission,
  openchoreoObservabilityplaneDeletePermission,
  openchoreoDeploymentpipelineUpdatePermission,
  openchoreoDeploymentpipelineDeletePermission,
  openchoreoClusterComponentTypeUpdatePermission,
  openchoreoClusterComponentTypeDeletePermission,
  openchoreoClusterTraitUpdatePermission,
  openchoreoClusterTraitDeletePermission,
  openchoreoClusterDataplaneUpdatePermission,
  openchoreoClusterDataplaneDeletePermission,
  openchoreoClusterWorkflowplaneUpdatePermission,
  openchoreoClusterWorkflowplaneDeletePermission,
  openchoreoClusterObservabilityplaneUpdatePermission,
  openchoreoClusterObservabilityplaneDeletePermission,
  openchoreoClusterWorkflowUpdatePermission,
  openchoreoClusterWorkflowDeletePermission,
  openchoreoPermissions,
  OPENCHOREO_PERMISSION_TO_ACTION,
  CATALOG_PERMISSION_TO_ACTION,
  CATALOG_KIND_TO_ACTION,
  OPENCHOREO_MANAGED_ENTITY_KINDS,
} from './permissions';
export {
  getRepositoryInfo,
  getRepositoryUrl,
  sanitizeLabel,
  filterEmptyObjectProperties,
  parseWorkflowParametersAnnotation,
} from './utils';
export type { RepositoryInfo } from './utils';
export {
  ComponentTypeUtils,
  type PageVariant,
  type ComponentTypeMapping,
} from './utils/componentTypeUtils';

// Feature flags types
export type { OpenChoreoFeatures, FeatureName } from './types/features';

// BFF response & request types (hand-written, decoupled from generated client)
export type {
  APIResponse,
  ListResponse,
  NamespaceResponse,
  ProjectResponse,
  DeploymentPipelineResponse,
  PromotionPath,
  TargetEnvironmentRef,
  ComponentResponse,
  ComponentTypeRef,
  ComponentTypeResponse,
  AllowedTraitResponse,
  PatchComponentRequest,
  ComponentWorkflow,
  ComponentTraitResponse,
  ComponentTraitRequest,
  UpdateComponentTraitsRequest,
  TraitResponse,
  ClusterComponentTypeResponse,
  ClusterTraitResponse,
  WorkflowResponse,
  ComponentWorkflowRunResponse,
  ComponentWorkflowConfigResponse,
  ComponentWorkflowRunStatusResponse,
  WorkflowStepStatus,
  ComponentWorkflowRunLogEntry,
  ComponentWorkflowRunEventEntry,
  BuildResponse,
  BuildTemplateResponse,
  BuildTemplateParameter,
  DataPlaneRef,
  EnvironmentResponse,
  AgentConnectionStatusResponse,
  DataPlaneResponse,
  ClusterDataPlaneResponse,
  WorkflowPlaneResponse,
  ObservabilityPlaneResponse,
  ReleaseBindingEndpointURLDetails,
  ReleaseBindingEndpoint,
  ReleaseBindingResponse,
  ReleaseBindingCondition,
  WorkloadOverrides,
  ContainerOverride,
  ComponentReleaseResponse,
  ComponentSchemaResponse,
  BindingResponse,
  BindingStatus,
  ServiceBinding,
  WebApplicationBinding,
  ScheduledTaskBinding,
  EndpointStatus,
  ExposedEndpoint,
  WorkloadType,
  WorkloadResponse,
  Container,
  EnvVar,
  FileVar,
  EnvVarValueFrom,
  SecretKeyRef,
  WorkloadEndpoint,
  Dependency,
  DependencyEnvBindings,
  WorkloadOwner,
  Schema,
  SecretReferenceResponse,
  SecretStoreReference,
  SecretDataSourceInfo,
  RemoteReferenceInfo,
  GitSecretResponse,
  SubjectType,
  UserCapabilitiesResponse,
  SubjectContext,
  ActionCapability,
  CapabilityResource,
  ReleaseResponse,
  ReleaseSpec,
  ReleaseStatus,
  ReleaseOwner,
  Resource,
  ResourceStatus,
  Condition,
  PromoteComponentRequest,
  DeployReleaseRequest,
  PatchReleaseBindingRequest,
  CreateComponentReleaseRequest,
} from './types/bff-types';

// Convenience aliases for backwards compatibility
import type {
  BuildResponse,
  WorkloadResponse,
  ComponentResponse,
  ComponentWorkflowRunStatusResponse,
} from './types/bff-types';
import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';

export type ModelsBuild = BuildResponse;
export type ModelsWorkload = WorkloadResponse;
/** Full K8s Workload resource type from the OpenAPI spec */
export type WorkloadResource = OpenChoreoComponents['schemas']['Workload'];
/** Spec portion of a WorkloadResource */
export type WorkloadSpec = NonNullable<WorkloadResource['spec']>;
export type ModelsCompleteComponent = ComponentResponse;
export type WorkflowRunStatusResponse = ComponentWorkflowRunStatusResponse;

// Re-export types from separate OpenAPI specs (not part of this migration)
export type {
  OpenChoreoComponents,
  ObservabilityComponents,
  AIRCAAgentComponents,
} from '@openchoreo/openchoreo-client-node';

// Observability types — aligned with /api/v1/logs/query response schema
import type { ObservabilityComponents } from '@openchoreo/openchoreo-client-node';

/** A single component log entry returned by the unified logs query endpoint */
export type ComponentLogEntry =
  ObservabilityComponents['schemas']['ComponentLogEntry'];

/** A single workflow/build log entry returned by the unified logs query endpoint */
export type WorkflowLogEntry =
  ObservabilityComponents['schemas']['WorkflowLogEntry'];

/**
 * Response from the unified /api/v1/logs/query endpoint.
 * `logs` is ComponentLogEntry[] when using ComponentSearchScope,
 * WorkflowLogEntry[] when using WorkflowSearchScope.
 */
export type LogsQueryResponse =
  ObservabilityComponents['schemas']['LogsQueryResponse'];

/**
 * @deprecated Use ComponentLogEntry or WorkflowLogEntry instead.
 * Kept for backwards compatibility — will be removed once all callers are migrated.
 */
export type LogEntry = ComponentLogEntry;

/**
 * @deprecated Use LogsQueryResponse instead.
 * Kept for backwards compatibility — will be removed once all callers are migrated.
 */
export interface RuntimeLogsResponse {
  logs: ComponentLogEntry[];
  total?: number;
  tookMs?: number;
}
