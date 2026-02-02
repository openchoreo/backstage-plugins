import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { genericWorkflowsClientApiRef } from '../api';
import { useNamespace } from './useOrgName';

interface UseWorkflowSchemaResult {
  schema: unknown | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch the JSONSchema for a workflow's parameters.
 */
export function useWorkflowSchema(
  workflowName: string,
): UseWorkflowSchemaResult {
  const client = useApi(genericWorkflowsClientApiRef);
  const namespaceName = useNamespace();

  const [schema, setSchema] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSchema = useCallback(async () => {
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
    if (workflowName) {
      fetchSchema();
    }
  }, [fetchSchema, workflowName]);

  return {
    schema,
    loading,
    error,
    refetch: fetchSchema,
  };
}
