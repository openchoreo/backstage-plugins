import { useCallback, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import type { LogEntry } from '../components/RuntimeLogs/types';

export interface UsePodLogsOptions {
  podName: string;
  namespaceName: string;
  projectName: string;
  environmentName: string;
  componentName: string;
  startTime?: string;
  endTime?: string;
}

export interface UsePodLogsResult {
  logs: LogEntry[];
  loading: boolean;
  error: string | null;
  fetchLogs: () => Promise<void>;
}

export function usePodLogs(options: UsePodLogsOptions): UsePodLogsResult {
  const observabilityApi = useApi(observabilityApiRef);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const fetchLogs = useCallback(async () => {
    if (
      !options.podName ||
      !options.namespaceName ||
      !options.environmentName ||
      !options.componentName
    ) {
      setLogs([]);
      return;
    }

    const version = ++requestVersionRef.current;

    try {
      setLoading(true);
      setError(null);

      const response = await observabilityApi.getPodLogs(
        options.podName,
        options.namespaceName,
        options.projectName,
        options.environmentName,
        options.componentName,
        {
          startTime: options.startTime,
          endTime: options.endTime,
          limit: 500,
          sortOrder: 'asc',
        },
      );

      if (version !== requestVersionRef.current) return;
      setLogs(response.logs ?? []);
    } catch (err) {
      if (version !== requestVersionRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      if (version === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [
    observabilityApi,
    options.podName,
    options.namespaceName,
    options.projectName,
    options.environmentName,
    options.componentName,
    options.startTime,
    options.endTime,
  ]);

  return { logs, loading, error, fetchLogs };
}
