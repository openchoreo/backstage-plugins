export interface LogEntry {
  timestamp: string;
  log: string;
  logLevel: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  componentId: string;
  environmentId: string;
  projectId: string;
  version: string;
  versionId: string;
  namespace: string;
  podId: string;
  containerName: string;
  labels: Record<string, string>;
}

export interface LogsResponse {
  logs: LogEntry[];
  totalCount: number;
  tookMs: number;
}

export interface Environment {
  id: string;
  name: string;
  resourceName: string;
}
