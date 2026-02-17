// Plugin exports
export { openchoreoWorkflowsPlugin, GenericWorkflowsPage } from './plugin';

// API exports
export { genericWorkflowsClientApiRef } from './api/GenericWorkflowsClientApi';
export type { GenericWorkflowsClientApi } from './api/GenericWorkflowsClientApi';
export { GenericWorkflowsClient } from './api/GenericWorkflowsClient';

// Entity-aware components (for use in catalog entity pages)
export { WorkflowTriggerContent } from './components/WorkflowTriggerContent';
export { WorkflowRunsContent } from './components/WorkflowRunsContent';
export { EntityNamespaceProvider } from './components/EntityNamespaceProvider';

// Type exports
export type {
  Workflow,
  WorkflowRun,
  WorkflowRunStatus,
  CreateWorkflowRunRequest,
  PaginatedResponse,
} from './types';
