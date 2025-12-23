import { useState, useCallback, useEffect, useRef } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  RoleEntitlementMapping,
  RoleMappingFilters,
  Entitlement,
  ResourceHierarchy,
  PolicyEffect,
} from '../../../api/OpenChoreoClientApi';

export type {
  RoleEntitlementMapping,
  RoleMappingFilters,
  Entitlement,
  ResourceHierarchy,
  PolicyEffect,
};

interface UseMappingsResult {
  mappings: RoleEntitlementMapping[];
  loading: boolean;
  error: Error | null;
  filters: RoleMappingFilters;
  setFilters: (filters: RoleMappingFilters) => void;
  fetchMappings: (filters?: RoleMappingFilters) => Promise<void>;
  addMapping: (mapping: RoleEntitlementMapping) => Promise<void>;
  updateMapping: (
    mappingId: number,
    mapping: RoleEntitlementMapping,
  ) => Promise<void>;
  deleteMapping: (mappingId: number) => Promise<void>;
}

export function useMappings(): UseMappingsResult {
  const [mappings, setMappings] = useState<RoleEntitlementMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFiltersState] = useState<RoleMappingFilters>({});
  const filtersRef = useRef<RoleMappingFilters>({});

  const client = useApi(openChoreoClientApiRef);

  const fetchMappings = useCallback(
    async (overrideFilters?: RoleMappingFilters) => {
      try {
        setLoading(true);
        setError(null);
        const activeFilters = overrideFilters ?? filtersRef.current;
        const result = await client.listRoleMappings(activeFilters);
        setMappings(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const setFilters = useCallback(
    (newFilters: RoleMappingFilters) => {
      filtersRef.current = newFilters;
      setFiltersState(newFilters);
      fetchMappings(newFilters);
    },
    [fetchMappings],
  );

  const addMapping = useCallback(
    async (mapping: RoleEntitlementMapping) => {
      await client.addRoleMapping(mapping);
      await fetchMappings();
    },
    [client, fetchMappings],
  );

  const updateMapping = useCallback(
    async (mappingId: number, mapping: RoleEntitlementMapping) => {
      await client.updateRoleMapping(mappingId, mapping);
      await fetchMappings();
    },
    [client, fetchMappings],
  );

  const deleteMapping = useCallback(
    async (mappingId: number) => {
      // Find the mapping by ID
      const mapping = mappings.find(m => m.id === mappingId);
      if (!mapping) {
        throw new Error(`Mapping with ID ${mappingId} not found`);
      }
      await client.deleteRoleMapping(mapping);
      await fetchMappings();
    },
    [client, fetchMappings, mappings],
  );

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  return {
    mappings,
    loading,
    error,
    filters,
    setFilters,
    fetchMappings,
    addMapping,
    updateMapping,
    deleteMapping,
  };
}
