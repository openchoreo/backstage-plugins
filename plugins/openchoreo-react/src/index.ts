/**
 * @openchoreo/backstage-plugin-react
 *
 * Shared React components, hooks, and utilities for OpenChoreo Backstage plugins
 */

// Components
export { SummaryWidgetWrapper } from './components/SummaryWidgetWrapper';
export {
  FeatureGate,
  FeatureGatedContent,
  withFeatureGate,
  type FeatureGateProps,
  type FeatureGatedContentProps,
} from './components/FeatureGate';
export {
  AnnotationGate,
  withAnnotationGate,
  AnnotationGatedContent,
  type AnnotationGateProps,
  type AnnotationGatedContentProps,
} from './components/AnnotationGate';
export {
  LoadingState,
  type LoadingStateProps,
} from './components/LoadingState';
export { ErrorState, type ErrorStateProps } from './components/ErrorState';
export {
  ForbiddenState,
  type ForbiddenStateProps,
} from './components/ForbiddenState';
export { EmptyState, type EmptyStateProps } from './components/EmptyState';
export {
  ImageSelector,
  type ImageSelectorProps,
} from './components/ImageSelector';
export {
  EnvVarEditor,
  type EnvVarEditorProps,
} from './components/EnvVarEditor';
export {
  FileVarEditor,
  type FileVarEditorProps,
} from './components/FileVarEditor';
export {
  StandardEnvVarList,
  type StandardEnvVarListProps,
} from './components/StandardEnvVarList';
export {
  OverrideEnvVarList,
  type OverrideEnvVarListProps,
} from './components/OverrideEnvVarList';
export {
  EnvVarStatusBadge,
  type EnvVarStatusBadgeProps,
} from './components/EnvVarStatusBadge';
export {
  StandardFileVarList,
  type StandardFileVarListProps,
} from './components/StandardFileVarList';
export {
  OverrideFileVarList,
  type OverrideFileVarListProps,
} from './components/OverrideFileVarList';
export {
  FileVarStatusBadge,
  type FileVarStatusBadgeProps,
} from './components/FileVarStatusBadge';
export {
  EndpointEditor,
  type EndpointEditorProps,
} from './components/EndpointEditor';
export {
  EndpointList,
  type EndpointListProps,
} from './components/EndpointList';
export {
  DependencyEditor,
  type DependencyEditorProps,
  type ProjectOption,
  type ComponentOption,
  type EndpointOption,
} from './components/DependencyEditor';
export {
  DependencyList,
  type DependencyListProps,
} from './components/DependencyList';
export {
  ResourceDependencyDisplay,
  type ResourceDependencyDisplayProps,
} from './components/ResourceDependencyDisplay';
export {
  ResourceDependencyEditor,
  type ResourceDependencyEditorProps,
  type ResourceOption,
} from './components/ResourceDependencyEditor';
export {
  GroupedSection,
  type GroupedSectionProps,
  type GroupedSectionStatus,
} from './components/GroupedSection';
export {
  UnsavedChangesDialog,
  type UnsavedChangesDialogProps,
} from './components/UnsavedChangesDialog';
export {
  DetailPageLayout,
  type DetailPageLayoutProps,
} from './components/DetailPageLayout';
export {
  NotificationBanner,
  type NotificationBannerProps,
  type NotificationVariant,
} from './components/NotificationBanner';
export {
  PipelineFlowVisualization,
  type PipelineFlowVisualizationProps,
  type PipelinePromotionPath,
} from './components/PipelineFlowVisualization';
export {
  buildEnvPipelineNodes,
  buildPathPipelineNodes,
  computePipelineLayout,
  PipelineEdge,
  usePipelineStyles,
  ENV_NODE_WIDTH,
  ENV_NODE_HEIGHT,
  SETUP_NODE_WIDTH,
  SETUP_NODE_HEIGHT,
  MINI_ENV_NODE_WIDTH,
  MINI_ENV_NODE_HEIGHT,
  MINI_SETUP_NODE_WIDTH,
  MINI_SETUP_NODE_HEIGHT,
  type EnvPipelineInput,
  type PathPipelineInput,
  type ComputeLayoutOptions,
  type EdgeLine,
  type PipelineNode,
  type PipelineParent,
  type LayoutPipelineNode,
  type PipelineEdgeData,
  type PipelineLayout,
} from './components/PipelineFlowVisualization/dag';
export {
  YamlEditor,
  useYamlEditor,
  type YamlEditorProps,
  type UseYamlEditorOptions,
  type UseYamlEditorResult,
} from './components/YamlEditor';
export {
  YamlDiffViewer,
  type YamlDiffViewerProps,
} from './components/YamlDiffViewer';
export {
  TraitConfigToggle,
  type TraitConfigToggleProps,
} from './components/TraitConfigToggle';
export {
  OpenChoreoEntityLayout,
  type OpenChoreoEntityLayoutProps,
  type ExtraContextMenuItem,
} from './components/OpenChoreoEntityLayout';
export {
  VirtualizedLogList,
  type VirtualizedLogListProps,
} from './components/VirtualizedLogList';
export { makeColumnStyle } from './components/VirtualizedLogList/columnStyle';

// Hooks
export {
  useRowExpansion,
  type UseRowExpansionResult,
} from './hooks/useRowExpansion';
export {
  useAutoLoadWhenEmpty,
  type UseAutoLoadWhenEmptyOptions,
} from './hooks/useAutoLoadWhenEmpty';
export {
  useEntityAnnotation,
  useHasAnnotation,
  useHasAnyAnnotation,
} from './hooks/useEntityAnnotation';
export {
  useOpenChoreoFeatures,
  useWorkflowsEnabled,
  useObservabilityEnabled,
  useAuthEnabled,
  useAuthzEnabled,
  useSecretManagementEnabled,
  useAssistantEnabled,
} from './hooks/useOpenChoreoFeatures';
export {
  useComponentEntityDetails,
  extractComponentEntityDetails,
  type ComponentEntityDetails,
} from './hooks/useComponentEntityDetails';
export {
  useSecretReferences,
  filterSecretReferencesForEnvDataPlane,
  type UseSecretReferencesResult,
  type SecretReference,
  type SecretDataSourceInfo,
} from './hooks/useSecretReferences';
export {
  useContainerForm,
  type UseContainerFormOptions,
  type UseContainerFormResult,
} from './hooks/useContainerForm';
export {
  useModeState,
  type UseModeStateOptions,
  type UseModeStateResult,
  type ValueMode,
} from './hooks/useModeState';
export {
  useEnvVarEditBuffer,
  type UseEnvVarEditBufferOptions,
  type UseEnvVarEditBufferResult,
  type EditingRowState,
} from './hooks/useEnvVarEditBuffer';
export {
  useFileVarEditBuffer,
  type UseFileVarEditBufferOptions,
  type UseFileVarEditBufferResult,
} from './hooks/useFileVarEditBuffer';
export {
  useEndpointEditBuffer,
  type UseEndpointEditBufferOptions,
  type UseEndpointEditBufferResult,
  type EndpointEditingRowState,
} from './hooks/useEndpointEditBuffer';
export {
  useDependencyEditBuffer,
  type UseDependencyEditBufferOptions,
  type UseDependencyEditBufferResult,
  type DependencyEditingRowState,
} from './hooks/useDependencyEditBuffer';
export {
  useResourceDependencyEditBuffer,
  type UseResourceDependencyEditBufferOptions,
  type UseResourceDependencyEditBufferResult,
  type ResourceDependencyEditingRowState,
} from './hooks/useResourceDependencyEditBuffer';
export {
  useChangeDetection,
  type UseChangeDetectionResult,
} from './hooks/useChangeDetection';
export {
  useUrlSyncedTab,
  type UseUrlSyncedTabOptions,
  type UseUrlSyncedTabResult,
} from './hooks/useUrlSyncedTab';
export {
  useBuildPermission,
  type UseBuildPermissionResult,
} from './hooks/useBuildPermission';
export {
  useWorkflowScopedPermission,
  type WorkflowContext,
  type UseWorkflowScopedPermissionResult,
} from './hooks/useWorkflowScopedPermission';
export {
  useComponentCreateContextPermission,
  type ComponentTypeContext,
  type UseComponentCreateContextPermissionOptions,
  type UseComponentCreateContextPermissionResult,
} from './hooks/useComponentCreateContextPermission';
export {
  useComponentCreateContextPermissions,
  type ComponentCreateContextItem,
  type ComponentCreateContextDecision,
  type UseComponentCreateContextPermissionsOptions,
  type UseComponentCreateContextPermissionsResult,
} from './hooks/useComponentCreateContextPermissions';
export {
  useResourceCreateContextPermission,
  type ResourceTypeContext,
  type UseResourceCreateContextPermissionOptions,
  type UseResourceCreateContextPermissionResult,
} from './hooks/useResourceCreateContextPermission';
export {
  useResourceCreateContextPermissions,
  type ResourceCreateContextItem,
  type ResourceCreateContextDecision,
  type UseResourceCreateContextPermissionsOptions,
  type UseResourceCreateContextPermissionsResult,
} from './hooks/useResourceCreateContextPermissions';
export {
  useDeployPermission,
  type UseDeployPermissionResult,
} from './hooks/useDeployPermission';
export {
  useComponentUpdatePermission,
  type UseComponentUpdatePermissionResult,
} from './hooks/useComponentUpdatePermission';
export {
  useComponentUpdateContextPermission,
  type UseComponentUpdateContextPermissionResult,
} from './hooks/useComponentUpdateContextPermission';
export {
  useResourceUpdateContextPermission,
  type UseResourceUpdateContextPermissionResult,
} from './hooks/useResourceUpdateContextPermission';
export {
  useWorkloadUpdatePermission,
  type UseWorkloadUpdatePermissionResult,
} from './hooks/useWorkloadUpdatePermission';
export {
  useConfigureAndDeployPermission,
  type UseConfigureAndDeployPermissionResult,
} from './hooks/useConfigureAndDeployPermission';
export {
  useExecPermission,
  type UseExecPermissionResult,
} from './hooks/useExecPermission';
export {
  useLogsPermission,
  type UseLogsPermissionResult,
} from './hooks/useLogsPermission';
export {
  useEventsPermission,
  type UseEventsPermissionResult,
} from './hooks/useEventsPermission';
export {
  useMetricsPermission,
  type UseMetricsPermissionResult,
} from './hooks/useMetricsPermission';
export {
  useTracesPermission,
  type UseTracesPermissionResult,
} from './hooks/useTracesPermission';
export {
  useRcaPermission,
  type UseRcaPermissionResult,
} from './hooks/useRcaPermission';
export {
  useRcaUpdatePermission,
  type UseRcaUpdatePermissionResult,
} from './hooks/useRcaUpdatePermission';
export {
  useFinopsUpdatePermission,
  type UseFinopsUpdatePermissionResult,
} from './hooks/useFinopsUpdatePermission';
export {
  useTraitsPermission,
  type UseTraitsPermissionResult,
} from './hooks/useTraitsPermission';
export {
  useAlertsPermission,
  type UseAlertsPermissionResult,
} from './hooks/useAlertsPermission';
export {
  useWirelogsPermission,
  type UseWirelogsPermissionResult,
} from './hooks/useWirelogsPermission';
export {
  useIncidentsPermission,
  type UseIncidentsPermissionResult,
} from './hooks/useIncidentsPermission';
export {
  useRolePermissions,
  type UseRolePermissionsResult,
} from './hooks/useRolePermissions';
export {
  useClusterRolePermissions,
  type UseClusterRolePermissionsResult,
} from './hooks/useClusterRolePermissions';
export {
  useRoleMappingPermissions,
  type UseRoleMappingPermissionsResult,
} from './hooks/useRoleMappingPermissions';
export {
  useClusterRoleMappingPermissions,
  type UseClusterRoleMappingPermissionsResult,
} from './hooks/useClusterRoleMappingPermissions';
export {
  useNamespacePermission,
  type UseNamespacePermissionResult,
} from './hooks/useNamespacePermission';
export {
  useProjectPermission,
  type UseProjectPermissionResult,
} from './hooks/useProjectPermission';
export {
  useComponentCreatePermission,
  type UseComponentCreatePermissionResult,
} from './hooks/useComponentCreatePermission';
export {
  useEnvironmentPermission,
  type UseEnvironmentPermissionResult,
} from './hooks/useEnvironmentPermission';
export {
  useNotificationChannelPermission,
  type UseNotificationChannelPermissionResult,
} from './hooks/useNotificationChannelPermission';
export {
  useDeploymentPipelinePermission,
  type UseDeploymentPipelinePermissionResult,
} from './hooks/useDeploymentPipelinePermission';
export {
  useEnvironmentReadPermission,
  type UseEnvironmentReadPermissionResult,
} from './hooks/useEnvironmentReadPermission';
export {
  useNotificationChannelReadPermission,
  type UseNotificationChannelReadPermissionResult,
} from './hooks/useNotificationChannelReadPermission';
export {
  useUndeployPermission,
  type UseUndeployPermissionResult,
} from './hooks/useUndeployPermission';
export {
  useReleaseBindingUpdatePermission,
  type UseReleaseBindingUpdatePermissionResult,
} from './hooks/useReleaseBindingUpdatePermission';
export {
  useResourceReleaseBindingUpdatePermission,
  type UseResourceReleaseBindingUpdatePermissionResult,
} from './hooks/useResourceReleaseBindingUpdatePermission';
export {
  useResourceReleaseBindingCreatePermission,
  type UseResourceReleaseBindingCreatePermissionResult,
} from './hooks/useResourceReleaseBindingCreatePermission';
export {
  useResourceReleaseBindingDeletePermission,
  type UseResourceReleaseBindingDeletePermissionResult,
} from './hooks/useResourceReleaseBindingDeletePermission';
export {
  useRemoveDeploymentPermission,
  type UseRemoveDeploymentPermissionResult,
} from './hooks/useRemoveDeploymentPermission';
export {
  useReleaseBindingViewPermission,
  type UseReleaseBindingViewPermissionResult,
} from './hooks/useReleaseBindingViewPermission';
export {
  usePromoteToEnvPermission,
  type UsePromoteToEnvPermissionResult,
} from './hooks/usePromoteToEnvPermission';
export {
  useResourcePromoteToEnvPermission,
  type UseResourcePromoteToEnvPermissionResult,
} from './hooks/useResourcePromoteToEnvPermission';
export {
  useReleaseBindingPermission,
  type UseReleaseBindingPermissionResult,
} from './hooks/useReleaseBindingPermission';
export {
  useTraitCreatePermission,
  type UseTraitCreatePermissionResult,
} from './hooks/useTraitCreatePermission';
export {
  useComponentTypePermission,
  type UseComponentTypePermissionResult,
} from './hooks/useComponentTypePermission';
export {
  useComponentWorkflowPermission,
  type UseComponentWorkflowPermissionResult,
} from './hooks/useComponentWorkflowPermission';
export {
  useWorkflowPermission,
  type UseWorkflowPermissionResult,
} from './hooks/useWorkflowPermission';
export {
  useClusterWorkflowPermission,
  type UseClusterWorkflowPermissionResult,
} from './hooks/useClusterWorkflowPermission';
export {
  useClusterTraitCreatePermission,
  type UseClusterTraitCreatePermissionResult,
} from './hooks/useClusterTraitCreatePermission';
export {
  useClusterComponentTypePermission,
  type UseClusterComponentTypePermissionResult,
} from './hooks/useClusterComponentTypePermission';
export {
  useClusterResourceTypePermission,
  type UseClusterResourceTypePermissionResult,
} from './hooks/useClusterResourceTypePermission';
export {
  useResourceTypePermission,
  type UseResourceTypePermissionResult,
} from './hooks/useResourceTypePermission';
export {
  useClusterProjectTypePermission,
  type UseClusterProjectTypePermissionResult,
} from './hooks/useClusterProjectTypePermission';
export {
  useProjectTypePermission,
  type UseProjectTypePermissionResult,
} from './hooks/useProjectTypePermission';
export {
  useResourceCreatePermission,
  type UseResourceCreatePermissionResult,
} from './hooks/useResourceCreatePermission';
export {
  useResourceDefinitionPermission,
  type UseResourceDefinitionPermissionResult,
} from './hooks/useResourceDefinitionPermission';
export {
  useScopedComponentCreatePermission,
  type UseScopedComponentCreatePermissionResult,
} from './hooks/useScopedComponentCreatePermission';
export {
  useScopedProjectCreatePermission,
  type UseScopedProjectCreatePermissionResult,
} from './hooks/useScopedProjectCreatePermission';
export {
  useProjectUpdatePermission,
  type UseProjectUpdatePermissionResult,
} from './hooks/useProjectUpdatePermission';
export {
  useAsyncOperation,
  type AsyncStatus,
  type AsyncState,
} from './hooks/useAsyncOperation';

// Change Detection Components
export { ChangeDiff, type ChangeDiffProps } from './components/ChangeDiff';
export {
  ChangesList,
  type ChangesListProps,
  type ChangesSection,
} from './components/ChangesList';

// Utilities
export {
  formatRelativeTime,
  calculateTimeRange,
  pickRangeForAge,
} from './utils/timeUtils';
export {
  buildYamlString,
  buildYamlData,
  generateDefaults,
} from './utils/jsonSchemaYaml';
export {
  deepCompareObjects,
  formatChangeValue,
  getChangeStats,
  type Change,
  type ChangeStats,
  type FormatValueOptions,
} from './utils/changeDetection';
export {
  mergeEnvVarsWithStatus,
  getBaseEnvVarsForContainer,
  formatEnvVarValue,
  type EnvVarStatus,
  type EnvVarWithStatus,
} from './utils/envVarUtils';
export {
  mergeFileVarsWithStatus,
  getBaseFileVarsForContainer,
  formatFileVarValue,
  getFileVarContentPreview,
  type FileVarStatus,
  type FileVarWithStatus,
} from './utils/fileVarUtils';
export {
  groupByStatus,
  hasAnyItems,
  getTotalCount,
  type StatusCounts,
  type GroupedItems,
} from './utils/overrideGroupUtils';

// Graph utilities
export {
  KIND_LABEL_PREFIXES,
  KIND_FULL_LABELS,
  getEntityKindPalette,
  getNodeColor,
  getNodeTintFill,
  getDefaultNodeColor,
  getEdgeColor,
  getDeletionWarningColor,
  getNodeDisplayLabel,
  getNodeKindLabel,
  isNodeMarkedForDeletion,
  withAlpha,
} from './utils/graphUtils';
export { DEPENDENCY_GRAPH_CUSTOM_ZOOM_ATTR } from './constants/graph';
export {
  type GraphViewDefinition,
  type FilterPreset,
  APPLICATION_VIEW,
  INFRASTRUCTURE_VIEW,
  CLUSTER_VIEW,
  ALL_VIEWS,
  getFilterPresets,
  ALL_FILTERABLE_KINDS,
  CLUSTER_NAMESPACE,
  CLUSTER_SCOPED_KINDS,
  buildDynamicView,
  getEffectiveKinds,
} from './utils/platformOverviewConstants';

// Graph components
export { CustomGraphNode } from './components/CustomGraphNode';
export { GraphLegend, type GraphLegendProps } from './components/GraphLegend';
export {
  GraphKindFilter,
  type GraphKindFilterProps,
} from './components/GraphKindFilter';
export {
  NamespaceScopeFilter,
  type NamespaceScopeFilterProps,
} from './components/NamespaceScopeFilter';
export {
  PlatformOverviewGraphView,
  type PlatformOverviewGraphViewProps,
} from './components/PlatformOverviewGraphView';
export {
  GraphMinimap,
  type GraphMinimapProps,
} from './components/GraphMinimap';
export {
  GraphControls,
  type GraphControlsProps,
} from './components/GraphControls';
export {
  HtmlGraphMinimap,
  type HtmlGraphMinimapProps,
  type HtmlGraphMinimapNode,
} from './components/HtmlGraphMinimap';
export {
  useHtmlGraphZoom,
  type UseHtmlGraphZoomOptions,
  type UseHtmlGraphZoomResult,
} from './hooks/useHtmlGraphZoom';
export type {
  GraphTransform,
  GraphViewBox,
  GraphViewport,
} from './hooks/useGraphZoom';

// Graph hooks
export { useAllEntitiesOfKinds } from './hooks/useAllEntitiesOfKinds';
export {
  useEntityGraphData,
  type UseEntityGraphDataResult,
} from './hooks/useEntityGraphData';
export { useProjects, type ProjectEntry } from './hooks/useProjects';
export {
  useCreateComponentPath,
  type UseCreateComponentPathResult,
} from './hooks/useCreateComponentPath';
export {
  useCreateResourcePath,
  type UseCreateResourcePathResult,
} from './hooks/useCreateResourcePath';

// Re-export graph types for consumers
export { type EntityNode } from '@backstage/plugin-catalog-graph';

// Routing utilities
export * from './routing';
export * from './components/TimeRangeFilter';
export * from './components/EnvironmentFilter';
export {
  useProjectEnvironments,
  type UseProjectEnvironmentsResult,
} from './hooks/useProjectEnvironments';
