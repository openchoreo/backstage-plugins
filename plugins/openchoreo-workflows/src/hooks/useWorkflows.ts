import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { genericWorkflowsClientApiRef } from '../api';
import type { Workflow } from '../types';
import { useSelectedNamespace } from '../context';

interface UseWorkflowsResult {
  workflows: Workflow[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch workflow templates for the selected namespace.
 * Must be used within a NamespaceProvider.
 */
export function useWorkflows(): UseWorkflowsResult {
  const client = useApi(genericWorkflowsClientApiRef);
  const namespaceName = useSelectedNamespace();

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    ['workflows', namespaceName],
    async () => {
      const response = await client.listWorkflows(namespaceName);
      return response.items;
    },
    { enabled: !!namespaceName },
  );

  return {
    workflows: data ?? [],
    loading,
    isRefetching,
    error,
    refetch: async () => {
      await refetch();
    },
  };
}
