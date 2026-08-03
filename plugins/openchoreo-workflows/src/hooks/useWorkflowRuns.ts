import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { genericWorkflowsClientApiRef } from '../api';
import type { WorkflowRun } from '../types';
import { useSelectedNamespace } from '../context';

interface UseWorkflowRunsResult {
  runs: WorkflowRun[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const POLLING_INTERVAL = 5000; // 5 seconds

// Check if there are any active runs (Pending or Running)
function hasActiveRuns(runs?: WorkflowRun[]): boolean {
  return !!runs?.some(run => {
    const status = (run.phase || run.status)?.toLowerCase();
    return status === 'pending' || status === 'running';
  });
}

/**
 * Hook to fetch workflow runs.
 * Automatically polls for updates when there are active runs.
 * Must be used within a NamespaceProvider.
 *
 * @param workflowName - Optional workflow name to filter runs by
 * @param namespaceName - Optional explicit namespace override for cluster workflows; falls back to NamespaceContext
 */
export function useWorkflowRuns(
  workflowName?: string,
  namespaceName?: string,
): UseWorkflowRunsResult {
  const client = useApi(genericWorkflowsClientApiRef);
  const contextNamespace = useSelectedNamespace();
  const resolvedNamespace = namespaceName ?? contextNamespace;

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    ['workflow-runs', resolvedNamespace ?? null, workflowName ?? null],
    () =>
      client
        .listWorkflowRuns(resolvedNamespace!, workflowName)
        .then(r => r.items),
    {
      enabled: !!resolvedNamespace,
      refetchInterval: query =>
        hasActiveRuns(query.state.data) ? POLLING_INTERVAL : false,
    },
  );

  return {
    runs: data ?? [],
    loading,
    isRefetching,
    error,
    refetch: async () => {
      await refetch();
    },
  };
}
