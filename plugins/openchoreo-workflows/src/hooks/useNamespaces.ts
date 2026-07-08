import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { genericWorkflowsClientApiRef } from '../api';

interface UseNamespacesResult {
  namespaces: string[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch the list of OpenChoreo namespaces
 * (Kubernetes namespaces labeled openchoreo.dev/control-plane=true).
 */
export function useNamespaces(): UseNamespacesResult {
  const client = useApi(genericWorkflowsClientApiRef);

  const { data, loading, error } = useOpenChoreoQuery(['namespaces'], () =>
    client.listNamespaces(),
  );

  return { namespaces: data ?? [], loading, error };
}
