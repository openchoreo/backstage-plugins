/**
 * Routing utilities for building links to OpenChoreo pages
 */

// Types
export type {
  PendingDeployAction,
  PendingPromoteAction,
  PendingAction,
  EnvironmentView,
  WorkflowView,
  WorkflowTab,
  RunDetailsTab,
} from './types';

// Serialization utilities
export {
  serializePendingAction,
  deserializePendingAction,
} from './pendingAction';

// Path builders (pure functions)
export {
  buildEntityPath,
  buildEnvironmentsBasePath,
  buildWorkflowsBasePath,
  buildRuntimeLogsBasePath,
  buildOverridesPath,
  buildReleaseDetailsPath,
  buildWorkloadConfigPath,
  buildOverridesPathWithTab,
  buildWorkflowRunPath,
  buildWorkflowConfigPath,
  buildWorkflowListPath,
} from './pathBuilders';

// Hook
export { useEntityLinks, type EntityLinks } from './useEntityLinks';
