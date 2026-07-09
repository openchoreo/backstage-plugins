import { useApi } from '@backstage/core-plugin-api';
import {
  useOpenChoreoQuery,
  useOpenChoreoMutation,
} from '@openchoreo/backstage-plugin-react';
import {
  openChoreoClientApiRef,
  NamespaceRole,
} from '../../../api/OpenChoreoClientApi';

/** Query key for a namespace's role list. */
const namespaceRolesKey = (namespace: string | undefined) => [
  'access-control',
  'namespace-roles',
  namespace ?? null,
];

interface UseNamespaceRolesResult {
  roles: NamespaceRole[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
  fetchRoles: () => Promise<void>;
  addRole: (role: NamespaceRole) => Promise<void>;
  updateRole: (name: string, role: Partial<NamespaceRole>) => Promise<void>;
  deleteRole: (name: string) => Promise<void>;
}

export function useNamespaceRoles(
  namespace: string | undefined,
): UseNamespaceRolesResult {
  const client = useApi(openChoreoClientApiRef);

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    namespaceRolesKey(namespace),
    () => client.listNamespaceRoles(namespace as string),
    // No namespace → nothing to fetch (the old hook cleared the list early).
    { enabled: !!namespace },
  );

  const invalidates = [namespaceRolesKey(namespace)];
  const { mutate: addRole } = useOpenChoreoMutation(
    (role: NamespaceRole) => client.createNamespaceRole(role),
    { invalidates },
  );
  const { mutate: updateRole } = useOpenChoreoMutation(
    (name: string, role: Partial<NamespaceRole>) => {
      if (!namespace) throw new Error('Namespace is required');
      return client.updateNamespaceRole(namespace, name, role);
    },
    { invalidates },
  );
  const { mutate: deleteRole } = useOpenChoreoMutation(
    (name: string) => {
      if (!namespace) throw new Error('Namespace is required');
      return client.deleteNamespaceRole(namespace, name);
    },
    { invalidates },
  );

  return {
    roles: data ?? [],
    loading,
    isRefetching,
    error,
    fetchRoles: async () => refetch(),
    addRole: async role => {
      await addRole(role);
    },
    updateRole: async (name, role) => {
      await updateRole(name, role);
    },
    deleteRole: async name => {
      await deleteRole(name);
    },
  };
}
