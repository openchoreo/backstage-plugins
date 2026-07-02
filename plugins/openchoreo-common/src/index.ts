export {
  CHOREO_ANNOTATIONS,
  CHOREO_LABELS,
  GENERIC_SECRET_TYPE_VALUE,
  GIT_SECRET_TYPE_VALUE,
  RELATION_DEPLOYS_TO,
  RELATION_DEPLOYED_BY,
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
  RELATION_NOTIFIES,
  RELATION_NOTIFIED_BY,
} from './constants';

// Permissions
export {
  OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
  OPENCHOREO_RESOURCE_TYPE_PROJECT,
  openchoreoComponentCreatePermission,
  openchoreoComponentReadPermission,
  openchoreoComponentBuildPermission,
  openchoreoComponentViewBuildsPermission,
  openchoreoReleaseBindingCreatePermission,
  openchoreoComponentUpdatePermission,
  openchoreoWorkloadUpdatePermission,
  openchoreoProjectCreatePermission,
  openchoreoComponentCreateScopedPermission,
  openchoreoProjectCreateScopedPermission,
  openchoreoProjectReadPermission,
  openchoreoProjectUpdatePermission,
  openchoreoNamespaceReadPermission,
  openchoreoNamespaceCreatePermission,
  openchoreoNamespaceUpdatePermission,
  openchoreoNamespaceDeletePermission,
  openchoreoEnvironmentCreatePermission,
  openchoreoEnvironmentReadPermission,
  openchoreoNotificationChannelCreatePermission,
  openchoreoNotificationChannelReadPermission,
  openchoreoReleaseCreatePermission,
  openchoreoReleaseReadPermission,
  openchoreoReleaseBindingUpdatePermission,
  openchoreoReleaseBindingDeletePermission,
  openchoreoReleaseBindingReadPermission,
  openchoreoReleaseBindingViewPermission,
  openchoreoResourceReleaseBindingUpdatePermission,
  openchoreoResourceReleaseBindingCreatePermission,
  openchoreoResourceReleaseBindingDeletePermission,
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
  openchoreoExecPermission,
  openchoreoLogsViewPermission,
  openchoreoEventsViewPermission,
  openchoreoAlertsViewPermission,
  openchoreoWirelogsViewPermission,
  openchoreoIncidentsViewPermission,
  openchoreoMetricsViewPermission,
  openchoreoTracesViewPermission,
  openchoreoRcaViewPermission,
  openchoreoRcaUpdatePermission,
  openchoreoFinopsUpdatePermission,
  openchoreoTraitsViewPermission,
  openchoreoTraitCreatePermission,
  openchoreoComponentTypeCreatePermission,
  openchoreoResourceTypeCreatePermission,
  openchoreoProjectTypeCreatePermission,
  openchoreoResourceCreatePermission,
  openchoreoClusterComponentTypeCreatePermission,
  openchoreoClusterResourceTypeCreatePermission,
  openchoreoClusterProjectTypeCreatePermission,
  openchoreoClusterTraitCreatePermission,
  openchoreoWorkflowCreatePermission,
  openchoreoClusterWorkflowCreatePermission,
  openchoreoComponentWorkflowCreatePermission,
  openchoreoComponentTypeUpdatePermission,
  openchoreoComponentTypeDeletePermission,
  openchoreoResourceTypeUpdatePermission,
  openchoreoResourceTypeDeletePermission,
  openchoreoProjectTypeUpdatePermission,
  openchoreoProjectTypeDeletePermission,
  openchoreoResourceUpdatePermission,
  openchoreoResourceDeletePermission,
  openchoreoTraitUpdatePermission,
  openchoreoTraitDeletePermission,
  openchoreoWorkflowUpdatePermission,
  openchoreoWorkflowDeletePermission,
  openchoreoComponentWorkflowUpdatePermission,
  openchoreoComponentWorkflowDeletePermission,
  openchoreoEnvironmentUpdatePermission,
  openchoreoEnvironmentDeletePermission,
  openchoreoNotificationChannelUpdatePermission,
  openchoreoNotificationChannelDeletePermission,
  openchoreoDataplaneUpdatePermission,
  openchoreoDataplaneDeletePermission,
  openchoreoWorkflowplaneUpdatePermission,
  openchoreoWorkflowplaneDeletePermission,
  openchoreoObservabilityplaneUpdatePermission,
  openchoreoObservabilityplaneDeletePermission,
  openchoreoDeploymentpipelineCreatePermission,
  openchoreoDeploymentpipelineUpdatePermission,
  openchoreoDeploymentpipelineDeletePermission,
  openchoreoClusterComponentTypeUpdatePermission,
  openchoreoClusterComponentTypeDeletePermission,
  openchoreoClusterResourceTypeUpdatePermission,
  openchoreoClusterResourceTypeDeletePermission,
  openchoreoClusterProjectTypeUpdatePermission,
  openchoreoClusterProjectTypeDeletePermission,
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
  ComponentWorkflowConfig,
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
  ResourceReleaseBindingResponse,
  ProjectReleaseBindingResponse,
  ResolvedResourceOutput,
  ResourceSecretKeyRef,
  ResourceConfigMapKeyRef,
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
  SecretReferenceTargetPlane,
  SecretStoreReference,
  SecretDataSourceInfo,
  RemoteReferenceInfo,
  SubjectType,
  UserCapabilitiesResponse,
  SubjectContext,
  ActionCapability,
  CapabilityResource,
  CapabilityConstraints,
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
/**
 * A resource dependency entry under Workload.spec.dependencies.resources[].
 * Binds named outputs of a Resource into the consuming container as env vars
 * (envBindings) and file mounts (fileBindings).
 */
export type ResourceDependency =
  OpenChoreoComponents['schemas']['WorkloadResourceDependency'];
/**
 * An output declared on a (Cluster)ResourceType's spec.outputs[]. The "kind"
 * (value / secretKeyRef / configMapKeyRef) is implicit in which field is set.
 * Consumed by the resource-dependency editor to render one row per output.
 */
export type ResourceTypeOutput =
  OpenChoreoComponents['schemas']['ResourceTypeOutput'];
/** ComponentRelease resource type from the OpenAPI spec */
export type ComponentRelease =
  OpenChoreoComponents['schemas']['ComponentRelease'];
export type ModelsCompleteComponent = ComponentResponse;
export type WorkflowRunStatusResponse = ComponentWorkflowRunStatusResponse;

// Re-export types from separate OpenAPI specs (not part of this migration)
export type {
  OpenChoreoComponents,
  ObservabilityComponents,
  AIRCAAgentComponents,
} from '@openchoreo/openchoreo-client-node';

// Workflow status helpers (shared by build/workflow log + event tabs)
export { isTerminalStatus, isStepLive } from './workflowStatus';

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

/** A single Kubernetes event entry returned by the /api/v1/events/query endpoint */
export type ComponentEventEntry =
  ObservabilityComponents['schemas']['EventEntry'];

/** Response from the /api/v1/events/query endpoint. */
export type EventsQueryResponse =
  ObservabilityComponents['schemas']['EventsQueryResponse'];
