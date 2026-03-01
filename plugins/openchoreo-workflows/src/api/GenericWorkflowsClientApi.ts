import { createApiRef } from '@backstage/core-plugin-api';
import type {
  Workflow,
  WorkflowRun,
  PaginatedResponse,
  LogsResponse,
  WorkflowRunStatusResponse,
  WorkflowRunEventEntry,
} from '../types';

/**
 * API client for generic workflow operations.
 *
 * This client provides methods for:
 * - Listing workflow templates
 * - Getting workflow schemas
 * - Listing and managing workflow runs
 *
 * After the Organization CRD removal, the hierarchy is now:
 * Namespace → Project → Component
 */
export interface GenericWorkflowsClientApi {
  /** List all workflow templates for a namespace */
  listWorkflows(namespaceName: string): Promise<PaginatedResponse<Workflow>>;

  /** Get the JSONSchema for a workflow's parameters */
  getWorkflowSchema(
    namespaceName: string,
    workflowName: string,
  ): Promise<unknown>;

  /** List workflow runs for a namespace, optionally filtered by workflow name */
  listWorkflowRuns(
    namespaceName: string,
    workflowName?: string,
  ): Promise<PaginatedResponse<WorkflowRun>>;

  /** Get details of a specific workflow run */
  getWorkflowRun(namespaceName: string, runName: string): Promise<WorkflowRun>;

  /** Create (trigger) a new workflow run */
  createWorkflowRun(
    namespaceName: string,
    workflowName: string,
    parameters?: Record<string, unknown>,
  ): Promise<WorkflowRun>;

  /** Get logs for a specific workflow run, optionally filtered by task */
  getWorkflowRunLogs(
    namespaceName: string,
    runName: string,
    task?: string,
  ): Promise<LogsResponse>;

  /** Get status (including steps) for a specific workflow run */
  getWorkflowRunStatus(
    namespaceName: string,
    runName: string,
  ): Promise<WorkflowRunStatusResponse>;

  /** Get Kubernetes events for a specific workflow run, optionally filtered by task */
  getWorkflowRunEvents(
    namespaceName: string,
    runName: string,
    task?: string,
  ): Promise<WorkflowRunEventEntry[]>;
}

/**
 * ApiRef for the generic workflows client.
 *
 * Usage:
 * ```typescript
 * import { genericWorkflowsClientApiRef } from '@openchoreo/backstage-plugin-openchoreo-workflows';
 *
 * const client = useApi(genericWorkflowsClientApiRef);
 * ```
 */
export const genericWorkflowsClientApiRef =
  createApiRef<GenericWorkflowsClientApi>({
    id: 'plugin.openchoreo-workflows.client',
  });
