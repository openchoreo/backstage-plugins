import { useCallback, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  useOpenChoreoQuery,
  useOpenChoreoMutation,
} from '@openchoreo/backstage-plugin-react';
import {
  openChoreoClientApiRef,
  ClusterRoleBinding,
  ClusterRoleBindingRequest,
  ClusterRoleBindingFilters,
} from '../../../api/OpenChoreoClientApi';

/**
 * Query key for the bindings list. Filters are part of the key, so changing
 * filters naturally swaps to (and caches) a different query — replacing the old
 * manual `fetchBindings(newFilters)` call.
 */
const bindingsKey = (filters: ClusterRoleBindingFilters) => [
  'access-control',
  'cluster-role-bindings',
  filters,
];

interface UseClusterRoleBindingsResult {
  bindings: ClusterRoleBinding[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
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
  const client = useApi(openChoreoClientApiRef);
  const [filters, setFiltersState] = useState<ClusterRoleBindingFilters>({});

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    bindingsKey(filters),
    () => client.listClusterRoleBindings(filters),
  );

  // Writes invalidate the current-filter list query, which refetches it.
  const invalidates = [bindingsKey(filters)];
  const { mutate: addBinding } = useOpenChoreoMutation(
    (binding: ClusterRoleBindingRequest) =>
      client.createClusterRoleBinding(binding),
    { invalidates },
  );
  const { mutate: updateBinding } = useOpenChoreoMutation(
    (name: string, binding: Partial<ClusterRoleBindingRequest>) =>
      client.updateClusterRoleBinding(name, binding),
    { invalidates },
  );
  const { mutate: deleteBinding } = useOpenChoreoMutation(
    (name: string) => client.deleteClusterRoleBinding(name),
    { invalidates },
  );

  // Changing filters just updates state; the query key changes and refetches.
  const setFilters = useCallback((newFilters: ClusterRoleBindingFilters) => {
    setFiltersState(newFilters);
  }, []);

  return {
    bindings: data ?? [],
    loading,
    isRefetching,
    error,
    filters,
    setFilters,
    // Kept for call sites that force a refresh. An explicit override sets the
    // filters (which refetches via the key); otherwise refetch the current key.
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
