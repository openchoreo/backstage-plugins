import { useState, useCallback, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

interface UseActionsResult {
  actions: string[];
  loading: boolean;
  error: Error | null;
  fetchActions: () => Promise<void>;
}

export function useActions(): UseActionsResult {
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const client = useApi(openChoreoClientApiRef);

  const fetchActions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await client.listActions();
      setActions(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  return {
    actions,
    loading,
    error,
    fetchActions,
  };
}
