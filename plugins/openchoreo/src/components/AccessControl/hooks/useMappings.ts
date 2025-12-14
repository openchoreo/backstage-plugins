import { useState, useCallback, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  RoleEntitlementMapping,
  Entitlement,
  ResourceHierarchy,
  PolicyEffect,
} from '../../../api/OpenChoreoClientApi';

export type { RoleEntitlementMapping, Entitlement, ResourceHierarchy, PolicyEffect };

interface UseMappingsResult {
  mappings: RoleEntitlementMapping[];
  loading: boolean;
  error: Error | null;
  fetchMappings: () => Promise<void>;
  addMapping: (mapping: RoleEntitlementMapping) => Promise<void>;
  deleteMapping: (mapping: RoleEntitlementMapping) => Promise<void>;
}

export function useMappings(): UseMappingsResult {
  const [mappings, setMappings] = useState<RoleEntitlementMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const client = useApi(openChoreoClientApiRef);

  const fetchMappings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await client.listRoleMappings();
      setMappings(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [client]);

  const addMapping = useCallback(async (mapping: RoleEntitlementMapping) => {
    await client.addRoleMapping(mapping);
    await fetchMappings();
  }, [client, fetchMappings]);

  const deleteMapping = useCallback(async (mapping: RoleEntitlementMapping) => {
    await client.deleteRoleMapping(mapping);
    await fetchMappings();
  }, [client, fetchMappings]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  return {
    mappings,
    loading,
    error,
    fetchMappings,
    addMapping,
    deleteMapping,
  };
}
