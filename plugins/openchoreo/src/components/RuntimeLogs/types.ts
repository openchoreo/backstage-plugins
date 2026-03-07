/**
 * A single component log entry as returned by POST /api/v1/logs/query.
 */
export interface LogEntry {
  timestamp?: string;
  log?: string;
  level?: string;
  metadata?: {
    componentName?: string;
    projectName?: string;
    environmentName?: string;
    namespaceName?: string;
    componentUid?: string;
    projectUid?: string;
    environmentUid?: string;
    containerName?: string;
    podName?: string;
    podNamespace?: string;
  };
}

export interface LogsResponse {
  logs: LogEntry[];
  total?: number;
  tookMs?: number;
}

export interface Environment {
  id: string;
  name: string;
  resourceName: string;
}
