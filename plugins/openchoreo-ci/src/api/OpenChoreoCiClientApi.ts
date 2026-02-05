import { createApiRef } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import type {
  ModelsBuild,
  RuntimeLogsResponse,
  LogEntry,
  WorkflowRunStatusResponse,
} from '@openchoreo/backstage-plugin-common';

// ============================================
// Response Types
// ============================================

/** Workflow schema response */
export interface WorkflowSchemaResponse {
  success: boolean;
  data?: {
    schema?: unknown;
    systemParameters?: unknown;
    parameters?: unknown;
  };
}

// ============================================
// API Interface
// ============================================

/**
 * API client for OpenChoreo CI/Workflow operations.
 *
 * This client provides methods for:
 * - Fetching workflow schemas
 * - Updating workflow parameters
 * - Fetching build logs
 */
export interface OpenChoreoCiClientApi {
  /** Fetch workflow schema for configuration */
  fetchWorkflowSchema(
    namespaceName: string,
    workflowName: string,
  ): Promise<WorkflowSchemaResponse>;

  /** Update component workflow parameters */
  updateComponentWorkflowParameters(
    entity: Entity,
    systemParameters: Record<string, unknown> | null,
    parameters: Record<string, unknown> | null,
  ): Promise<any>;

  /** Fetch build logs for a specific build */
  // TODO: Deprecate this method and use the new method fetchWorkflowRunLogs instead
  fetchBuildLogsForBuild(build: ModelsBuild): Promise<RuntimeLogsResponse>;

  /**
   * Fetch workflow run status for a specific build.
   *
   * Returns overall status, step-level statuses, and the log URL indicating
   * where logs should be fetched from.
   */
  fetchWorkflowRunStatus(
    build: ModelsBuild,
  ): Promise<WorkflowRunStatusResponse>;

  /**
   * Fetches structured logs for a workflow run.
   *
   * @param namespaceName - The namespace of the workflow.
   * @param projectName - The project the workflow belongs to.
   * @param componentName - The component the workflow refers to.
   * @param runName - The name or ID of the workflow run.
   * @param hasLiveObservability - Whether live observability is enabled for this run.
   * @param options - Optional: step (for step-specific logs), sinceSeconds (to tail only recent logs).
   * @returns An array of LogEntry objects following the observability log format.
   *
   * Notes:
   *   - This method proxies log retrieval through the CI backend, which in turn may fetch data either from
   *     OpenChoreo APIs or directly from the Observability plane, depending on hasLiveObservability parameter.
   */
  fetchWorkflowRunLogs(
    namespaceName: string,
    projectName: string,
    componentName: string,
    runName: string,
    hasLiveObservability: boolean,
    options?: { step?: string; sinceSeconds?: number },
  ): Promise<LogEntry[]>;
}

// ============================================
// API Reference
// ============================================

/**
 * ApiRef for the OpenChoreo CI client.
 *
 * Usage:
 * ```typescript
 * import { openChoreoCiClientApiRef } from '@openchoreo/backstage-plugin-openchoreo-ci';
 *
 * const client = useApi(openChoreoCiClientApiRef);
 * ```
 */
export const openChoreoCiClientApiRef = createApiRef<OpenChoreoCiClientApi>({
  id: 'plugin.openchoreo-ci.client',
});
