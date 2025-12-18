import { useState, useCallback, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  AuthzRole,
  RoleEntitlementMapping,
} from '../../../api/OpenChoreoClientApi';

export type Role = AuthzRole;

interface UseRolesResult {
  roles: Role[];
  loading: boolean;
  error: Error | null;
  fetchRoles: () => Promise<void>;
  addRole: (role: Role) => Promise<void>;
  updateRole: (name: string, actions: string[]) => Promise<void>;
  deleteRole: (name: string, force?: boolean) => Promise<void>;
  getRoleMappings: (roleName: string) => Promise<RoleEntitlementMapping[]>;
}

export function useRoles(): UseRolesResult {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const client = useApi(openChoreoClientApiRef);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await client.listRoles();
      setRoles(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [client]);

  const addRole = useCallback(
    async (role: Role) => {
      await client.addRole(role);
      await fetchRoles();
    },
    [client, fetchRoles],
  );

  const updateRole = useCallback(
    async (name: string, actions: string[]) => {
      await client.updateRole(name, actions);
      await fetchRoles();
    },
    [client, fetchRoles],
  );

  const deleteRole = useCallback(
    async (name: string, force?: boolean) => {
      await client.deleteRole(name, force);
      await fetchRoles();
    },
    [client, fetchRoles],
  );

  const getRoleMappings = useCallback(
    async (roleName: string) => {
      return client.getRoleMappingsForRole(roleName);
    },
    [client],
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
    getRoleMappings,
  };
}
