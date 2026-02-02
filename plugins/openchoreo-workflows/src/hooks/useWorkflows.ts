import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { genericWorkflowsClientApiRef } from '../api';
import type { Workflow } from '../types';
import { useNamespace } from './useOrgName';

interface UseWorkflowsResult {
  workflows: Workflow[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch workflow templates for the namespace.
 */
export function useWorkflows(): UseWorkflowsResult {
  const client = useApi(genericWorkflowsClientApiRef);
  const namespaceName = useNamespace();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await client.listWorkflows(namespaceName);
      setWorkflows(response.items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client, namespaceName]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  return {
    workflows,
    loading,
    error,
    refetch: fetchWorkflows,
  };
}
