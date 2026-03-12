import { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { genericWorkflowsClientApiRef } from '../api';

interface UseNamespacesResult {
  namespaces: string[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch the list of OpenChoreo namespaces
 * (Kubernetes namespaces labeled openchoreo.dev/namespace=true).
 */
export function useNamespaces(): UseNamespacesResult {
  const client = useApi(genericWorkflowsClientApiRef);

  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchNamespaces = async () => {
      try {
        setError(null);
        const result = await client.listNamespaces();
        if (!cancelled) {
          setNamespaces(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchNamespaces();

    return () => {
      cancelled = true;
    };
  }, [client]);

  return { namespaces, loading, error };
}
