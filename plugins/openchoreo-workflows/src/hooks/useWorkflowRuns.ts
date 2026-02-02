import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { genericWorkflowsClientApiRef } from '../api';
import type { WorkflowRun } from '../types';
import { useNamespace } from './useOrgName';

interface UseWorkflowRunsResult {
  runs: WorkflowRun[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const POLLING_INTERVAL = 5000; // 5 seconds

/**
 * Hook to fetch workflow runs for the namespace.
 * Automatically polls for updates when there are active runs.
 *
 * @param workflowName - Optional workflow name to filter runs by
 */
export function useWorkflowRuns(workflowName?: string): UseWorkflowRunsResult {
  const client = useApi(genericWorkflowsClientApiRef);
  const namespaceName = useNamespace();

  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      setError(null);
      const response = await client.listWorkflowRuns(namespaceName, workflowName);
      setRuns(response.items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client, namespaceName, workflowName]);

  // Check if there are any active runs (Pending or Running)
  const hasActiveRuns = runs.some(
    run => run.status === 'Pending' || run.status === 'Running',
  );

  // Set up polling when there are active runs
  useEffect(() => {
    if (hasActiveRuns) {
      pollingRef.current = setInterval(() => {
        fetchRuns();
      }, POLLING_INTERVAL);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [hasActiveRuns, fetchRuns]);

  // Initial fetch
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  return {
    runs,
    loading,
    error,
    refetch: fetchRuns,
  };
}
