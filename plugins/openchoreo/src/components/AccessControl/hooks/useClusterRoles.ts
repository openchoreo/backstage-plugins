import { useApi } from '@backstage/core-plugin-api';
import {
  useOpenChoreoQuery,
  useOpenChoreoMutation,
} from '@openchoreo/backstage-plugin-react';
import {
  openChoreoClientApiRef,
  ClusterRole,
} from '../../../api/OpenChoreoClientApi';

/** Query key for the cluster-roles list. */
const CLUSTER_ROLES_KEY = ['access-control', 'cluster-roles'];

interface UseClusterRolesResult {
  roles: ClusterRole[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
  fetchRoles: () => Promise<void>;
  addRole: (role: ClusterRole) => Promise<void>;
  updateRole: (name: string, role: Partial<ClusterRole>) => Promise<void>;
  deleteRole: (name: string) => Promise<void>;
}

export function useClusterRoles(): UseClusterRolesResult {
  const client = useApi(openChoreoClientApiRef);

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    CLUSTER_ROLES_KEY,
    () => client.listClusterRoles(),
  );

  // Each write invalidates the list query, which refetches it — replacing the
  // hand-rolled `await fetchRoles()` that used to follow every mutation.
  const invalidates = [CLUSTER_ROLES_KEY];
  const { mutate: addRole } = useOpenChoreoMutation(
    (role: ClusterRole) => client.createClusterRole(role),
    { invalidates },
  );
  const { mutate: updateRole } = useOpenChoreoMutation(
    (name: string, role: Partial<ClusterRole>) =>
      client.updateClusterRole(name, role),
    { invalidates },
  );
  const { mutate: deleteRole } = useOpenChoreoMutation(
    (name: string) => client.deleteClusterRole(name),
    { invalidates },
  );

  return {
    roles: data ?? [],
    loading,
    isRefetching,
    error,
    // Preserved for call sites that trigger a manual refresh; `refetch` returns
    // void here, matching the previous `Promise<void>` contract closely enough.
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
