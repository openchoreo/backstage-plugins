import { useState, useCallback, useEffect, useRef } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  ClusterRoleBinding,
  ClusterRoleBindingRequest,
  ClusterRoleBindingFilters,
} from '../../../api/OpenChoreoClientApi';

interface UseClusterRoleBindingsResult {
  bindings: ClusterRoleBinding[];
  loading: boolean;
  error: Error | null;
  filters: ClusterRoleBindingFilters;
  setFilters: (filters: ClusterRoleBindingFilters) => void;
  fetchBindings: (filters?: ClusterRoleBindingFilters) => Promise<void>;
  addBinding: (binding: ClusterRoleBindingRequest) => Promise<void>;
  updateBinding: (
    name: string,
    binding: Partial<ClusterRoleBindingRequest>,
  ) => Promise<void>;
  deleteBinding: (name: string) => Promise<void>;
}

export function useClusterRoleBindings(): UseClusterRoleBindingsResult {
  const [bindings, setBindings] = useState<ClusterRoleBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFiltersState] = useState<ClusterRoleBindingFilters>({});
  const filtersRef = useRef<ClusterRoleBindingFilters>({});

  const client = useApi(openChoreoClientApiRef);

  const fetchBindings = useCallback(
    async (overrideFilters?: ClusterRoleBindingFilters) => {
      try {
        setLoading(true);
        setError(null);
        const activeFilters = overrideFilters ?? filtersRef.current;
        const result = await client.listClusterRoleBindings(activeFilters);
        setBindings(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const setFilters = useCallback(
    (newFilters: ClusterRoleBindingFilters) => {
      filtersRef.current = newFilters;
      setFiltersState(newFilters);
      fetchBindings(newFilters);
    },
    [fetchBindings],
  );

  const addBinding = useCallback(
    async (binding: ClusterRoleBindingRequest) => {
      await client.createClusterRoleBinding(binding);
      await fetchBindings();
    },
    [client, fetchBindings],
  );

  const updateBinding = useCallback(
    async (name: string, binding: Partial<ClusterRoleBindingRequest>) => {
      await client.updateClusterRoleBinding(name, binding);
      await fetchBindings();
    },
    [client, fetchBindings],
  );

  const deleteBinding = useCallback(
    async (name: string) => {
      await client.deleteClusterRoleBinding(name);
      await fetchBindings();
    },
    [client, fetchBindings],
  );

  useEffect(() => {
    fetchBindings();
  }, [fetchBindings]);

  return {
    bindings,
    loading,
    error,
    filters,
    setFilters,
    fetchBindings,
    addBinding,
    updateBinding,
    deleteBinding,
  };
}
