import { useState, useCallback, useEffect, useRef } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  NamespaceRoleBinding,
  NamespaceRoleBindingRequest,
  NamespaceRoleBindingFilters,
} from '../../../api/OpenChoreoClientApi';

interface UseNamespaceRoleBindingsResult {
  bindings: NamespaceRoleBinding[];
  loading: boolean;
  error: Error | null;
  filters: NamespaceRoleBindingFilters;
  setFilters: (filters: NamespaceRoleBindingFilters) => void;
  fetchBindings: (filters?: NamespaceRoleBindingFilters) => Promise<void>;
  addBinding: (binding: NamespaceRoleBindingRequest) => Promise<void>;
  updateBinding: (
    name: string,
    binding: NamespaceRoleBindingRequest,
  ) => Promise<void>;
  deleteBinding: (name: string) => Promise<void>;
}

export function useNamespaceRoleBindings(
  namespace: string | undefined,
): UseNamespaceRoleBindingsResult {
  const [bindings, setBindings] = useState<NamespaceRoleBinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFiltersState] = useState<NamespaceRoleBindingFilters>({});
  const filtersRef = useRef<NamespaceRoleBindingFilters>({});

  const client = useApi(openChoreoClientApiRef);

  const fetchBindings = useCallback(
    async (overrideFilters?: NamespaceRoleBindingFilters) => {
      if (!namespace) {
        setBindings([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const activeFilters = overrideFilters ?? filtersRef.current;
        const result = await client.listNamespaceRoleBindings(
          namespace,
          activeFilters,
        );
        setBindings(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    },
    [client, namespace],
  );

  const setFilters = useCallback(
    (newFilters: NamespaceRoleBindingFilters) => {
      filtersRef.current = newFilters;
      setFiltersState(newFilters);
      fetchBindings(newFilters);
    },
    [fetchBindings],
  );

  const addBinding = useCallback(
    async (binding: NamespaceRoleBindingRequest) => {
      if (!namespace) {
        throw new Error('Namespace is required');
      }
      await client.createNamespaceRoleBinding(namespace, binding);
      await fetchBindings();
    },
    [client, fetchBindings, namespace],
  );

  const updateBinding = useCallback(
    async (name: string, binding: NamespaceRoleBindingRequest) => {
      if (!namespace) {
        throw new Error('Namespace is required');
      }
      await client.updateNamespaceRoleBinding(namespace, name, binding);
      await fetchBindings();
    },
    [client, fetchBindings, namespace],
  );

  const deleteBinding = useCallback(
    async (name: string) => {
      if (!namespace) {
        throw new Error('Namespace is required');
      }
      await client.deleteNamespaceRoleBinding(namespace, name);
      await fetchBindings();
    },
    [client, fetchBindings, namespace],
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
