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
} from './constants';

// Permissions
export {
  OPENCHOREO_RESOURCE_TYPE_COMPONENT,
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
  openchoreoRoleViewPermission,
  openchoreoRoleCreatePermission,
  openchoreoRoleUpdatePermission,
  openchoreoRoleDeletePermission,
  openchoreoRoleMappingViewPermission,
  openchoreoRoleMappingCreatePermission,
  openchoreoRoleMappingUpdatePermission,
  openchoreoRoleMappingDeletePermission,
  openchoreoLogsViewPermission,
  openchoreoMetricsViewPermission,
  openchoreoTraitsViewPermission,
  openchoreoTraitCreatePermission,
  openchoreoComponentTypeCreatePermission,
  openchoreoComponentWorkflowCreatePermission,
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
} from './utils';
export type { RepositoryInfo } from './utils';
export {
  ComponentTypeUtils,
  type PageVariant,
  type ComponentTypeMapping,
} from './utils/componentTypeUtils';

// Feature flags types
export type { OpenChoreoFeatures, FeatureName } from './types/features';

// Re-export types from the generated OpenAPI client for use in frontend plugins
export type {
  OpenChoreoLegacyComponents,
  ObservabilityComponents,
  AIRCAAgentComponents,
} from '@openchoreo/openchoreo-client-node';

// Export commonly used type aliases for convenience
import type {
  OpenChoreoLegacyComponents,
  ObservabilityComponents,
} from '@openchoreo/openchoreo-client-node';

export type ModelsBuild =
  OpenChoreoLegacyComponents['schemas']['BuildResponse'];
export type ModelsWorkload =
  OpenChoreoLegacyComponents['schemas']['WorkloadResponse'];
export type ModelsCompleteComponent =
  OpenChoreoLegacyComponents['schemas']['ComponentResponse'];

// Workload-related types
export type Container = OpenChoreoLegacyComponents['schemas']['Container'];
export type EnvVar = OpenChoreoLegacyComponents['schemas']['EnvVar'];
export type FileVar = OpenChoreoLegacyComponents['schemas']['FileVar'];
export type WorkloadEndpoint =
  OpenChoreoLegacyComponents['schemas']['WorkloadEndpoint'];
export type Connection = OpenChoreoLegacyComponents['schemas']['Connection'];
export type WorkloadOwner =
  OpenChoreoLegacyComponents['schemas']['WorkloadOwner'];
export type ConnectionParams =
  OpenChoreoLegacyComponents['schemas']['ConnectionParams'];
export type ConnectionInject =
  OpenChoreoLegacyComponents['schemas']['ConnectionInject'];
export type Schema = OpenChoreoLegacyComponents['schemas']['Schema'];

// Workflow run / build logs status types
export type WorkflowRunStatusResponse =
  OpenChoreoLegacyComponents['schemas']['ComponentWorkflowRunStatusResponse'];
export type WorkflowStepStatus =
  OpenChoreoLegacyComponents['schemas']['WorkflowStepStatus'];

// Define WorkloadType as a string union since it's defined as enum in OpenAPI
export type WorkloadType =
  | 'Service'
  | 'ManualTask'
  | 'ScheduledTask'
  | 'WebApplication';

// Observability types
export type RuntimeLogsResponse =
  ObservabilityComponents['schemas']['LogResponse'];
export type LogEntry = ObservabilityComponents['schemas']['LogEntry'];
