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

// Utilities
export { formatRelativeTime } from './utils/timeUtils';
