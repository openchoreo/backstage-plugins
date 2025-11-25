import { useState, useCallback, useEffect } from 'react';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import { useComponentEntityDetails } from '@openchoreo/backstage-plugin-react';
import type {
  ModelsBuild,
  ModelsCompleteComponent,
} from '@openchoreo/backstage-plugin-common';

interface WorkflowDataState {
  builds: ModelsBuild[];
  componentDetails: ModelsCompleteComponent | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for fetching and managing workflow data (builds and component details).
 * Includes automatic polling for active builds.
 */
export function useWorkflowData() {
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const { getEntityDetails } = useComponentEntityDetails();

  const [state, setState] = useState<WorkflowDataState>({
    builds: [],
    componentDetails: null,
    loading: true,
    error: null,
  });

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
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const componentData = await response.json();
      setState(prev => ({ ...prev, componentDetails: componentData }));
    } catch (err) {
      setState(prev => ({ ...prev, error: err as Error }));
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
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buildsData = await response.json();
      setState(prev => ({ ...prev, builds: buildsData }));
    } catch (err) {
      setState(prev => ({ ...prev, error: err as Error }));
    }
  }, [discoveryApi, identityApi, getEntityDetails]);

  // Initial data fetch
  useEffect(() => {
    let ignore = false;

    const fetchData = async () => {
      await Promise.all([fetchComponentDetails(), fetchBuilds()]);
      if (!ignore) {
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    fetchData();

    return () => {
      ignore = true;
    };
  }, [fetchComponentDetails, fetchBuilds]);

  // Poll builds every 5 seconds if any build is in pending/running state
  useEffect(() => {
    const hasActiveBuilds = state.builds.some(build => {
      const status = build.status?.toLowerCase() || '';
      return (
        status.includes('pending') ||
        status.includes('running') ||
        status.includes('progress')
      );
    });

    if (!hasActiveBuilds) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      fetchBuilds();
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [state.builds, fetchBuilds]);

  return {
    builds: state.builds,
    componentDetails: state.componentDetails,
    loading: state.loading,
    error: state.error,
    fetchBuilds,
    fetchComponentDetails,
  };
}
