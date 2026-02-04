import { useState, useCallback, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  ClusterRole,
} from '../../../api/OpenChoreoClientApi';

interface UseClusterRolesResult {
  roles: ClusterRole[];
  loading: boolean;
  error: Error | null;
  fetchRoles: () => Promise<void>;
  addRole: (role: ClusterRole) => Promise<void>;
  updateRole: (name: string, role: Partial<ClusterRole>) => Promise<void>;
  deleteRole: (name: string) => Promise<void>;
}

export function useClusterRoles(): UseClusterRolesResult {
  const [roles, setRoles] = useState<ClusterRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const client = useApi(openChoreoClientApiRef);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await client.listClusterRoles();
      setRoles(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [client]);

  const addRole = useCallback(
    async (role: ClusterRole) => {
      await client.createClusterRole(role);
      await fetchRoles();
    },
    [client, fetchRoles],
  );

  const updateRole = useCallback(
    async (name: string, role: Partial<ClusterRole>) => {
      await client.updateClusterRole(name, role);
      await fetchRoles();
    },
    [client, fetchRoles],
  );

  const deleteRole = useCallback(
    async (name: string) => {
      await client.deleteClusterRole(name);
      await fetchRoles();
    },
    [client, fetchRoles],
  );

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return {
    roles,
    loading,
    error,
    fetchRoles,
    addRole,
    updateRole,
    deleteRole,
  };
}
