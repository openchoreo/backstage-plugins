import { useState, useCallback, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  NamespaceRole,
} from '../../../api/OpenChoreoClientApi';

interface UseNamespaceRolesResult {
  roles: NamespaceRole[];
  loading: boolean;
  error: Error | null;
  fetchRoles: () => Promise<void>;
  addRole: (role: NamespaceRole) => Promise<void>;
  updateRole: (name: string, role: Partial<NamespaceRole>) => Promise<void>;
  deleteRole: (name: string) => Promise<void>;
}

export function useNamespaceRoles(
  namespace: string | undefined,
): UseNamespaceRolesResult {
  const [roles, setRoles] = useState<NamespaceRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = useApi(openChoreoClientApiRef);

  const fetchRoles = useCallback(async () => {
    if (!namespace) {
      setRoles([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await client.listNamespaceRoles(namespace);
      setRoles(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [client, namespace]);

  const addRole = useCallback(
    async (role: NamespaceRole) => {
      await client.createNamespaceRole(role);
      await fetchRoles();
    },
    [client, fetchRoles],
  );

  const updateRole = useCallback(
    async (name: string, role: Partial<NamespaceRole>) => {
      if (!namespace) {
        throw new Error('Namespace is required');
      }
      await client.updateNamespaceRole(namespace, name, role);
      await fetchRoles();
    },
    [client, fetchRoles, namespace],
  );

  const deleteRole = useCallback(
    async (name: string) => {
      if (!namespace) {
        throw new Error('Namespace is required');
      }
      await client.deleteNamespaceRole(namespace, name);
      await fetchRoles();
    },
    [client, fetchRoles, namespace],
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
