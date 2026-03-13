import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { genericWorkflowsClientApiRef } from '../api';
import type { LogsResponse } from '../types';
import { useSelectedNamespace } from '../context';

interface UseWorkflowRunLogsResult {
  logs: LogsResponse | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const POLLING_INTERVAL = 5000; // 5 seconds

/**
 * Hook to fetch logs for a specific workflow run.
 * Automatically polls for updates when the run is active.
 * Must be used within a NamespaceProvider.
 *
 * @param runName - The name of the workflow run to fetch logs for
 * @param isRunActive - Whether the run is still active (Pending or Running)
 * @param namespaceName - Explicit namespace override. Falls back to the NamespaceContext value.
 *   Pass this explicitly for ClusterWorkflow runs whose namespace is user-selected.
 */
export function useWorkflowRunLogs(
  runName: string | undefined,
  isRunActive: boolean = false,
  namespaceName?: string,
): UseWorkflowRunLogsResult {
  const client = useApi(genericWorkflowsClientApiRef);
  const contextNamespace = useSelectedNamespace();
  const resolvedNamespace = namespaceName ?? contextNamespace;

  const [logs, setLogs] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!runName || !resolvedNamespace) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await client.getWorkflowRunLogs(
        resolvedNamespace,
        runName,
      );
      setLogs(response);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client, resolvedNamespace, runName]);

  // Set up polling when run is active
  useEffect(() => {
    if (isRunActive && runName) {
      pollingRef.current = setInterval(() => {
        fetchLogs();
      }, POLLING_INTERVAL);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isRunActive, runName, fetchLogs]);

  // Initial fetch
  useEffect(() => {
    if (runName) {
      fetchLogs();
    }
  }, [runName, fetchLogs]);

  return {
    logs,
    loading,
    error,
    refetch: fetchLogs,
  };
}
