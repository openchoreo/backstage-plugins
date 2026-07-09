import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { genericWorkflowsClientApiRef } from '../api';
import { useSelectedNamespace } from '../context';

interface UseWorkflowSchemaResult {
  schema: unknown | null;
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch the JSONSchema for a workflow's parameters.
 * Must be used within a NamespaceProvider.
 *
 * @param workflowName - The workflow name
 * @param workflowKind - 'ClusterWorkflow' calls the cluster-scoped schema endpoint;
 *                       anything else (or omitted) calls the namespace-scoped endpoint.
 */
export function useWorkflowSchema(
  workflowName: string,
  workflowKind?: 'Workflow' | 'ClusterWorkflow',
): UseWorkflowSchemaResult {
  const client = useApi(genericWorkflowsClientApiRef);
  const namespaceName = useSelectedNamespace();

  // Namespace-scoped workflows also require a namespace; cluster-scoped ones do not.
  const enabled =
    !!workflowName && (workflowKind === 'ClusterWorkflow' || !!namespaceName);

  const { data, loading, isRefetching, error, refetch } =
    useOpenChoreoQuery<unknown>(
      ['workflow-schema', workflowKind, namespaceName, workflowName],
      () => {
        if (workflowKind === 'ClusterWorkflow') {
          return client.getClusterWorkflowSchema(workflowName);
        }
        return client.getWorkflowSchema(namespaceName, workflowName);
      },
      { enabled },
    );

  return {
    schema: data ?? null,
    loading,
    isRefetching,
    error,
    refetch: async () => {
      await refetch();
    },
  };
}
