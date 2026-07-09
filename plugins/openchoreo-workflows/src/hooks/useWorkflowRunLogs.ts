import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { genericWorkflowsClientApiRef } from '../api';
import type { LogsResponse } from '../types';
import { useSelectedNamespace } from '../context';

interface UseWorkflowRunLogsResult {
  logs: LogsResponse | null;
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
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

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    ['workflow-run-logs', resolvedNamespace ?? null, runName ?? null],
    () => client.getWorkflowRunLogs(resolvedNamespace!, runName!),
    {
      enabled: !!runName && !!resolvedNamespace,
      refetchInterval: isRunActive ? POLLING_INTERVAL : false,
    },
  );

  return {
    logs: data ?? null,
    loading,
    isRefetching,
    error,
    refetch: async () => {
      await refetch();
    },
  };
}
