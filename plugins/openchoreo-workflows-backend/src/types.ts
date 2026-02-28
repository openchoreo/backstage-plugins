/**
 * Generic workflow template
 */
export interface Workflow {
  name: string;
  displayName?: string;
  description?: string;
  createdAt?: string;
}

/**
 * Status of a workflow run
 */
export type WorkflowRunStatus =
  | 'Pending'
  | 'Running'
  | 'Succeeded'
  | 'Failed'
  | 'Error';

/**
 * Generic workflow run
 */
export interface WorkflowRun {
  name: string;
  uuid?: string;
  workflowName: string;
  namespaceName: string;
  status: string;
  phase?: string;
  parameters?: Record<string, unknown>;
  createdAt?: string;
  finishedAt?: string;
}

/**
 * Request body for creating a workflow run
 */
export interface CreateWorkflowRunRequest {
  workflowName: string;
  workflowRunName?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  parameters?: Record<string, unknown>;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination?: {
    nextCursor?: string;
  };
}

/**
 * Single log entry from workflow execution
 */
export interface LogEntry {
  timestamp: string;
  log: string;
}

/**
 * Response containing workflow run logs
 */
export interface LogsResponse {
  logs: LogEntry[];
  totalCount: number;
  tookMs?: number;
}
