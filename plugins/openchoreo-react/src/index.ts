/**
 * @openchoreo/backstage-plugin-react
 *
 * Shared React components, hooks, and utilities for OpenChoreo Backstage plugins
 */

// Components
export { SummaryWidgetWrapper } from './components/SummaryWidgetWrapper';
export {
  FeatureGate,
  withFeatureGate,
  type FeatureGateProps,
} from './components/FeatureGate';
export {
  LoadingState,
  type LoadingStateProps,
} from './components/LoadingState';
export { ErrorState, type ErrorStateProps } from './components/ErrorState';
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

// Hooks
export { useInfiniteScroll } from './hooks/useInfiniteScroll';
export {
  useOpenChoreoFeatures,
  useWorkflowsEnabled,
  useObservabilityEnabled,
  useAuthEnabled,
  useAuthzEnabled,
} from './hooks/useOpenChoreoFeatures';
export {
  useComponentEntityDetails,
  extractComponentEntityDetails,
  type ComponentEntityDetails,
} from './hooks/useComponentEntityDetails';
export {
  useSecretReferences,
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
  useDeployPermission,
  type UseDeployPermissionResult,
} from './hooks/useDeployPermission';
export {
  useRolePermissions,
  type UseRolePermissionsResult,
} from './hooks/useRolePermissions';
export {
  useRoleMappingPermissions,
  type UseRoleMappingPermissionsResult,
} from './hooks/useRoleMappingPermissions';
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
export { formatRelativeTime, calculateTimeRange } from './utils/timeUtils';
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

// Routing utilities
export * from './routing';
