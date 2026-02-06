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
 */
export function useWorkflowSchema(
  workflowName: string,
): UseWorkflowSchemaResult {
  const client = useApi(genericWorkflowsClientApiRef);
  const namespaceName = useSelectedNamespace();

  const [schema, setSchema] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSchema = useCallback(async () => {
    if (!namespaceName || !workflowName) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await client.getWorkflowSchema(namespaceName, workflowName);
      setSchema(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client, namespaceName, workflowName]);

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
