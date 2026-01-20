import { createApiRef } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import type {
  ModelsBuild,
  RuntimeLogsResponse,
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
  fetchBuildLogsForBuild(build: ModelsBuild): Promise<RuntimeLogsResponse>;
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
