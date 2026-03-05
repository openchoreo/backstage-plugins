import type { ObservabilityComponents } from '@openchoreo/openchoreo-client-node';
import type { ComponentWorkflowRunEventEntry } from '@openchoreo/backstage-plugin-common';

// Log entry type from the unified /api/v1/logs/query endpoint
export type ComponentLogEntry =
  ObservabilityComponents['schemas']['ComponentLogEntry'];
export type WorkflowLogEntry =
  ObservabilityComponents['schemas']['WorkflowLogEntry'];

/** Simple log entry used by fetchWorkflowRunLogs (Kubernetes pod logs) */
export interface LogEntry {
  timestamp: string;
  log: string;
}

/** Response from /api/v1/logs/query for workflow/build scope */
export interface RuntimeLogsResponse {
  logs: WorkflowLogEntry[];
  total?: number;
  tookMs?: number;
}

// Kubernetes events from the OpenChoreo API
export type { ComponentWorkflowRunEventEntry };
