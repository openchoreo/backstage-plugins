import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { NotFoundError } from '@backstage/errors';
import { genericWorkflowsClientApiRef } from '../api';
import type { WorkflowRun } from '../types';
import { useSelectedNamespace } from '../context';

interface UseWorkflowRunDetailsResult {
  run: WorkflowRun | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const POLLING_INTERVAL = 5000; // 5 seconds
// After triggering, the WorkflowRun CR may not exist yet. Retry 404s for up
// to this many attempts (at 2 s apart) before surfacing the error.
const NOT_FOUND_RETRY_INTERVAL = 2000;
const NOT_FOUND_MAX_RETRIES = 5;

/**
 * Hook to fetch details of a specific workflow run.
 * Automatically polls for updates when the run is active.
 * Must be used within a NamespaceProvider.
 *
 * @param runName - The name of the workflow run to fetch details for
 * @param namespaceName - Explicit namespace override. Falls back to the NamespaceContext value
 *   (the entity's annotation namespace). Pass this explicitly for ClusterWorkflow runs whose
 *   namespace is user-selected and differs from the entity's context namespace.
 */
export function useWorkflowRunDetails(
  runName: string,
  namespaceName?: string,
): UseWorkflowRunDetailsResult {
  const client = useApi(genericWorkflowsClientApiRef);
  const contextNamespace = useSelectedNamespace();
  const resolvedNamespace = namespaceName ?? contextNamespace;

  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const notFoundRetriesRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cancelledRef = useRef(false);

  const fetchRun = useCallback(async () => {
    if (cancelledRef.current) return;
    if (!resolvedNamespace) {
      setRun(null);
      setLoading(false);
      return;
    }

    let retrying = false;
    try {
      setError(null);
      const data = await client.getWorkflowRun(resolvedNamespace, runName);
      notFoundRetriesRef.current = 0;
      setRun(data);
    } catch (err) {
      // A newly triggered WorkflowRun may not be visible immediately.
      // Retry silently a few times before surfacing the 404 as an error.
      if (
        err instanceof NotFoundError &&
        notFoundRetriesRef.current < NOT_FOUND_MAX_RETRIES
      ) {
        notFoundRetriesRef.current += 1;
        retrying = true;
        retryTimeoutRef.current = setTimeout(
          fetchRun,
          NOT_FOUND_RETRY_INTERVAL,
        );
      } else {
        notFoundRetriesRef.current = 0;
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      // Don't drop out of the loading state while we're still retrying
      if (!retrying) {
        setLoading(false);
      }
    }
  }, [client, resolvedNamespace, runName]);

  // Cancel any pending retry timeouts and mark the hook as unmounted
  // so stale fetchRun closures don't update state after unmount.
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      notFoundRetriesRef.current = 0;
    };
  }, [runName]);

  // Check if the run is active (Pending or Running)
  const runStatus = (run?.phase || run?.status)?.toLowerCase();
  const isActive = run && (runStatus === 'pending' || runStatus === 'running');

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
