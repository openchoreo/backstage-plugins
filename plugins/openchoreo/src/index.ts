export { choreoPlugin } from './plugin';
export { openChoreoClientApiRef } from './api/OpenChoreoClientApi';
// Exported so external Backstage hosts can register the API factory in
// their packages/app/src/apis.ts. Without this, hosts that do not include
// the plugin in their auto-discovered routes tree get a NotImplementedError
// at runtime when entity tabs (Environments, CellDiagram) try to useApi.
export { OpenChoreoClient } from './api/OpenChoreoClient';
export { Environments } from './components/Environments/Environments';
export { ResourceEnvironments } from './components/ResourceEnvironments';
export { CellDiagram } from './components/CellDiagram/CellDiagram';
export {
  WorkflowsOverviewCard,
  DeploymentStatusCard,
  RuntimeHealthCard,
  DeploymentPipelineCard,
  AccessControlPage,
} from './plugin';
export { AccessControlContent } from './components/AccessControl';
export { SecretsContent } from './components/Secrets';
export * from './components/HomePage/MyProjectsWidget';
export * from './components/HomePage/QuickActionsSection';
export { ProjectComponentsCard } from './components/Projects/ProjectComponentsCard';
export {
  NamespaceProjectsCard,
  NamespaceResourcesCard,
} from './components/Namespaces';
export {
  useDeleteEntityMenuItems,
  useEntityExistsCheck,
  DeletionBadge,
  DeletionWarning,
  isMarkedForDeletion,
  getDeletionTimestamp,
  type DeletePermissionInfo,
} from './components/DeleteEntity';
export { useAnnotationEditorMenuItems } from './components/AnnotationEditor';
export {
  EnvironmentStatusSummaryCard,
  EnvironmentDeployedComponentsCard,
  EnvironmentPromotionCard,
  EnvironmentPipelinesTab,
  EnvironmentGatewayConfigurationCard,
} from './components/EnvironmentOverview';
export {
  DataplaneStatusCard,
  DataplaneEnvironmentsCard,
  DataplaneGatewayConfigurationCard,
} from './components/DataplaneOverview';
export {
  ClusterDataplaneStatusCard,
  ClusterDataplaneEnvironmentsCard,
  ClusterDataplaneGatewayConfigurationCard,
} from './components/ClusterDataplaneOverview';
export { GatewayConfigurationCard } from './components/GatewayConfigurationCard';
export type { GatewayConfigurationCardProps } from './components/GatewayConfigurationCard';
export { WorkflowPlaneStatusCard } from './components/WorkflowPlaneOverview';
export { ClusterWorkflowPlaneStatusCard } from './components/ClusterWorkflowPlaneOverview';
export {
  ObservabilityPlaneStatusCard,
  ObservabilityPlaneLinkedPlanesCard,
} from './components/ObservabilityPlaneOverview';
export {
  ClusterObservabilityPlaneStatusCard,
  ClusterObservabilityPlaneLinkedPlanesCard,
} from './components/ClusterObservabilityPlaneOverview';
export {
  DeploymentPipelineVisualization,
  PromotionPathsCard,
} from './components/DeploymentPipelineOverview';
export { SecretsPage } from './components/Secrets';
export { ComponentTypeOverviewCard } from './components/ComponentTypeOverview';
export { ResourceTypeOverviewCard } from './components/ResourceTypeOverview';
export {
  ResourceParametersCard,
  ResourceDeploymentsCard,
  ConsumingComponentsCard,
} from './components/ResourceOverview';
export { TraitTypeOverviewCard } from './components/TraitTypeOverview';
export { WorkflowOverviewCard } from './components/WorkflowOverview';
export { ComponentWorkflowOverviewCard } from './components/ComponentWorkflowOverview';
export { ResourceDefinitionTab } from './components/ResourceDefinition';
export { useQueryParams } from './hooks/useQueryParams';
