import { useCallback, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  useOpenChoreoQuery,
  useOpenChoreoMutation,
} from '@openchoreo/backstage-plugin-react';
import {
  openChoreoClientApiRef,
  NamespaceRoleBinding,
  NamespaceRoleBindingRequest,
  NamespaceRoleBindingFilters,
} from '../../../api/OpenChoreoClientApi';

/** Query key for a namespace's bindings list; namespace + filters both part of it. */
const bindingsKey = (
  namespace: string | undefined,
  filters: NamespaceRoleBindingFilters,
) => ['access-control', 'namespace-role-bindings', namespace ?? null, filters];

interface UseNamespaceRoleBindingsResult {
  bindings: NamespaceRoleBinding[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
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
  const client = useApi(openChoreoClientApiRef);
  const [filters, setFiltersState] = useState<NamespaceRoleBindingFilters>({});

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    bindingsKey(namespace, filters),
    () => client.listNamespaceRoleBindings(namespace as string, filters),
    { enabled: !!namespace },
  );

  const invalidates = [bindingsKey(namespace, filters)];
  const { mutate: addBinding } = useOpenChoreoMutation(
    (binding: NamespaceRoleBindingRequest) => {
      if (!namespace) throw new Error('Namespace is required');
      return client.createNamespaceRoleBinding(namespace, binding);
    },
    { invalidates },
  );
  const { mutate: updateBinding } = useOpenChoreoMutation(
    (name: string, binding: NamespaceRoleBindingRequest) => {
      if (!namespace) throw new Error('Namespace is required');
      return client.updateNamespaceRoleBinding(namespace, name, binding);
    },
    { invalidates },
  );
  const { mutate: deleteBinding } = useOpenChoreoMutation(
    (name: string) => {
      if (!namespace) throw new Error('Namespace is required');
      return client.deleteNamespaceRoleBinding(namespace, name);
    },
    { invalidates },
  );

  const setFilters = useCallback((newFilters: NamespaceRoleBindingFilters) => {
    setFiltersState(newFilters);
  }, []);

  return {
    bindings: data ?? [],
    loading,
    isRefetching,
    error,
    filters,
    setFilters,
    fetchBindings: async overrideFilters => {
      if (overrideFilters) setFiltersState(overrideFilters);
      else refetch();
    },
    addBinding: async binding => {
      await addBinding(binding);
    },
    updateBinding: async (name, binding) => {
      await updateBinding(name, binding);
    },
    deleteBinding: async name => {
      await deleteBinding(name);
    },
  };
}
