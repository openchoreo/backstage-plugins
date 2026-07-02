export { choreoPlugin } from './plugin';
export { openChoreoClientApiRef } from './api/OpenChoreoClientApi';
// Exported so external Backstage hosts can register the API factory in
// their packages/app/src/apis.ts. Without this, hosts that do not include
// the plugin in their auto-discovered routes tree get a NotImplementedError
// at runtime when entity tabs (Environments, CellDiagram) try to useApi.
export { OpenChoreoClient } from './api/OpenChoreoClient';
export { Environments } from './components/Environments/Environments';
// Render-prop slot for injecting the assistant "Investigate" button into
// the deploy panel from the host app (keeps this plugin free of any
// portal-assistant dependency).
export type {
  RenderInvestigateAction,
  InvestigateScope,
} from './components/Environments/EnvironmentsContext';
export { ResourceEnvironments } from './components/ResourceEnvironments';
export { ProjectEnvironments } from './components/ProjectEnvironments';
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
export { ProjectContentsCard } from './components/Projects/ProjectContentsCard';
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
export { NotificationChannelConfigCard } from './components/NotificationChannelOverview';
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
export { ProjectTypeOverviewCard } from './components/ProjectTypeOverview';
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
export { ExecTerminalWindowPage } from './components/Terminal';
