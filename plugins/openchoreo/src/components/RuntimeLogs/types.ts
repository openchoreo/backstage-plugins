import type { ObservabilityComponents } from '@openchoreo/openchoreo-client-node';

/**
 * A single component log entry as returned by POST /api/v1/logs/query.
 */
export type LogEntry = ObservabilityComponents['schemas']['ComponentLogEntry'];

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
