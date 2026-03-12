import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { genericWorkflowsClientApiRef } from '../api';
import { useSelectedNamespace } from '../context';

interface UseWorkflowSchemaResult {
  schema: unknown | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch the JSONSchema for a workflow's parameters.
 * Must be used within a NamespaceProvider.
 *
 * @param workflowName - The workflow name
 * @param isClusterScoped - When true, calls the cluster-scoped schema endpoint
 *                          (for ClusterWorkflow entities). Defaults to false.
 */
export function useWorkflowSchema(
  workflowName: string,
  isClusterScoped = false,
): UseWorkflowSchemaResult {
  const client = useApi(genericWorkflowsClientApiRef);
  const namespaceName = useSelectedNamespace();

  const [schema, setSchema] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSchema = useCallback(async () => {
    if (!workflowName) {
      setLoading(false);
      return;
    }

    // Namespace-scoped workflows also require a namespace
    if (!isClusterScoped && !namespaceName) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      let data: unknown;
      if (isClusterScoped) {
        data = await client.getClusterWorkflowSchema(workflowName);
      } else {
        data = await client.getWorkflowSchema(namespaceName, workflowName);
      }
      setSchema(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client, namespaceName, workflowName, isClusterScoped]);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  return {
    schema,
    loading,
    error,
    refetch: fetchSchema,
  };
}
