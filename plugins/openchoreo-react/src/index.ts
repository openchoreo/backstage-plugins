/**
 * @openchoreo/backstage-plugin-react
 *
 * Shared React components, hooks, and utilities for OpenChoreo Backstage plugins
 */

// Components
export { SummaryWidgetWrapper } from './components/SummaryWidgetWrapper';
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

// Hooks
export { useInfiniteScroll } from './hooks/useInfiniteScroll';
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

// Utilities
export { formatRelativeTime } from './utils/timeUtils';
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
