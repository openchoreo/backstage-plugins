import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { genericWorkflowsClientApiRef } from '../api';

interface UseNamespacesResult {
  namespaces: string[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
}

/**
 * Hook to fetch the list of OpenChoreo namespaces
 * (Kubernetes namespaces labeled openchoreo.dev/control-plane=true).
 */
export function useNamespaces(): UseNamespacesResult {
  const client = useApi(genericWorkflowsClientApiRef);

  const { data, loading, isRefetching, error } = useOpenChoreoQuery(
    ['workflows', 'namespaces'],
    () => client.listNamespaces(),
  );

  return { namespaces: data ?? [], loading, isRefetching, error };
}
