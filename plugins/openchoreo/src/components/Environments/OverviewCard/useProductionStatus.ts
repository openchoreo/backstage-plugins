import { useCallback, useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import type { Environment } from '../hooks/useEnvironmentData';

interface ProductionStatusState {
  productionEnv: Environment | null;
  loading: boolean;
  error: Error | null;
  refreshing: boolean;
}

/**
 * Hook for fetching production environment status for the overview card.
 * Filters environments to find production (matches "prod" or "production").
 */
export function useProductionStatus() {
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);

  const [state, setState] = useState<ProductionStatusState>({
    productionEnv: null,
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchData = useCallback(async () => {
    try {
      const environments = (await client.fetchEnvironmentInfo(
        entity,
      )) as Environment[];

      // Find production environment (matches "prod" or "production", case-insensitive)
      const productionEnv = environments.find(env => {
        const name = env.name.toLowerCase();
        return name === 'prod' || name === 'production';
      });

      setState(prev => ({
        ...prev,
        productionEnv: productionEnv || null,
        loading: false,
        error: null,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err as Error,
      }));
    }
  }, [entity, client]);

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, refreshing: true }));
    try {
      await fetchData();
    } finally {
      setState(prev => ({ ...prev, refreshing: false }));
    }
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll if deployment is pending (NotReady)
  useEffect(() => {
    const status = state.productionEnv?.deployment?.status;
    if (status !== 'NotReady') return undefined;

    const intervalId = setInterval(() => {
      fetchData();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [state.productionEnv, fetchData]);

  // Determine deployment status
  const isDeployed = Boolean(state.productionEnv?.deployment?.status);
  const deploymentStatus = state.productionEnv?.deployment?.status;

  return {
    productionEnv: state.productionEnv,
    isDeployed,
    deploymentStatus,
    loading: state.loading,
    error: state.error,
    refreshing: state.refreshing,
    refresh,
  };
}
