import { useEffect, useState, useCallback } from 'react';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import type {
  ModelsBuild,
  ModelsCompleteComponent,
} from '@openchoreo/backstage-plugin-common';

interface EntityDetails {
  componentName: string;
  projectName: string;
  organizationName: string;
}

interface UseBuildsDataReturn {
  builds: ModelsBuild[];
  componentDetails: ModelsCompleteComponent | null;
  loading: boolean;
  error: Error | null;
  triggeringBuild: boolean;
  refreshing: boolean;
  triggerBuild: () => Promise<void>;
  refreshBuilds: () => Promise<void>;
}

/**
 * Hook for fetching and managing builds data.
 */
export function useBuildsData(
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  getEntityDetails: () => Promise<EntityDetails>,
): UseBuildsDataReturn {
  const [builds, setBuilds] = useState<ModelsBuild[]>([]);
  const [componentDetails, setComponentDetails] =
    useState<ModelsCompleteComponent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [triggeringBuild, setTriggeringBuild] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchComponentDetails = useCallback(async () => {
    try {
      const { componentName, projectName, organizationName } =
        await getEntityDetails();

      const { token } = await identityApi.getCredentials();
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

      const response = await fetch(
        `${baseUrl}/component?componentName=${encodeURIComponent(
          componentName,
        )}&projectName=${encodeURIComponent(
          projectName,
        )}&organizationName=${encodeURIComponent(organizationName)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setComponentDetails(data);
    } catch (err) {
      setError(err as Error);
    }
  }, [discoveryApi, identityApi, getEntityDetails]);

  const fetchBuilds = useCallback(async () => {
    try {
      const { componentName, projectName, organizationName } =
        await getEntityDetails();

      const { token } = await identityApi.getCredentials();
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

      const response = await fetch(
        `${baseUrl}/builds?componentName=${encodeURIComponent(
          componentName,
        )}&projectName=${encodeURIComponent(
          projectName,
        )}&organizationName=${encodeURIComponent(organizationName)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setBuilds(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [discoveryApi, identityApi, getEntityDetails]);

  const triggerBuild = useCallback(async () => {
    setTriggeringBuild(true);
    try {
      const { componentName, projectName, organizationName } =
        await getEntityDetails();

      const { token } = await identityApi.getCredentials();
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

      const response = await fetch(`${baseUrl}/builds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          componentName,
          projectName,
          organizationName,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await fetchBuilds();
    } catch (err) {
      setError(err as Error);
    } finally {
      setTriggeringBuild(false);
    }
  }, [discoveryApi, identityApi, getEntityDetails, fetchBuilds]);

  const refreshBuilds = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchBuilds();
    } catch (err) {
      setError(err as Error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchBuilds]);

  useEffect(() => {
    let ignore = false;
    const fetchData = async () => {
      await Promise.all([fetchComponentDetails(), fetchBuilds()]);
    };
    if (!ignore) fetchData();

    return () => {
      ignore = true;
    };
  }, [fetchComponentDetails, fetchBuilds]);

  return {
    builds,
    componentDetails,
    loading,
    error,
    triggeringBuild,
    refreshing,
    triggerBuild,
    refreshBuilds,
  };
}
