import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { genericWorkflowsClientApiRef } from '../api';
import type { WorkflowRun } from '../types';
import { useNamespace } from './useOrgName';

interface UseWorkflowRunDetailsResult {
  run: WorkflowRun | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const POLLING_INTERVAL = 5000; // 5 seconds

/**
 * Hook to fetch details of a specific workflow run.
 * Automatically polls for updates when the run is active.
 */
export function useWorkflowRunDetails(
  runName: string,
): UseWorkflowRunDetailsResult {
  const client = useApi(genericWorkflowsClientApiRef);
  const namespaceName = useNamespace();

  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRun = useCallback(async () => {
    try {
      setError(null);
      const data = await client.getWorkflowRun(namespaceName, runName);
      setRun(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client, namespaceName, runName]);

  // Check if the run is active (Pending or Running)
  const isActive =
    run && (run.status === 'Pending' || run.status === 'Running');

  // Set up polling when the run is active
  useEffect(() => {
    if (isActive) {
      pollingRef.current = setInterval(() => {
        fetchRun();
      }, POLLING_INTERVAL);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isActive, fetchRun]);

  // Initial fetch
  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  return {
    run,
    loading,
    error,
    refetch: fetchRun,
  };
}
