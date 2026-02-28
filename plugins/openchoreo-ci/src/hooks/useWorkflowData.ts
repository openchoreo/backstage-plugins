import { useState, useCallback, useEffect } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { useComponentEntityDetails } from '@openchoreo/backstage-plugin-react';
import type {
  ModelsBuild,
  ModelsCompleteComponent,
} from '@openchoreo/backstage-plugin-common';
import { CHOREO_LABELS } from '@openchoreo/backstage-plugin-common';

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
  const fetchApi = useApi(fetchApiRef);
  const { getEntityDetails } = useComponentEntityDetails();

  const [state, setState] = useState<WorkflowDataState>({
    builds: [],
    componentDetails: null,
    loading: true,
    error: null,
  });

  const fetchComponentDetails = useCallback(async () => {
    try {
      const { componentName, projectName, namespaceName } =
        await getEntityDetails();

      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

      const response = await fetchApi.fetch(
        `${baseUrl}/component?componentName=${encodeURIComponent(
          componentName,
        )}&projectName=${encodeURIComponent(
          projectName,
        )}&namespaceName=${encodeURIComponent(namespaceName)}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const componentData = await response.json();
      setState(prev => ({ ...prev, componentDetails: componentData }));
    } catch (err) {
      // Don't set error state — let componentDetails remain null so the UI
      // shows "Workflows Not Available" instead of a raw HTTP error.
      setState(prev => ({ ...prev, componentDetails: null }));
    }
  }, [discoveryApi, fetchApi, getEntityDetails]);

  const fetchBuilds = useCallback(async () => {
    try {
      const { componentName, projectName, namespaceName } =
        await getEntityDetails();

      const baseUrl = await discoveryApi.getBaseUrl(
        'openchoreo-workflows-backend',
      );

      const params = new URLSearchParams({ namespaceName });
      if (projectName) params.set('projectName', projectName);
      if (componentName) params.set('componentName', componentName);

      const response = await fetchApi.fetch(
        `${baseUrl}/workflow-runs?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      // Map WorkflowRun items to ModelsBuild shape for UI compatibility
      const buildsData: ModelsBuild[] = (result.items || []).map(
        (run: any) => ({
          name: run.name,
          uuid: run.uuid || '',
          componentName:
            run.labels?.[CHOREO_LABELS.WORKFLOW_COMPONENT] || componentName,
          projectName:
            run.labels?.[CHOREO_LABELS.WORKFLOW_PROJECT] || projectName,
          namespaceName: run.namespaceName,
          status: run.status,
          createdAt: run.createdAt,
          parameters: run.parameters,
        }),
      );
      setState(prev => ({ ...prev, builds: buildsData }));
    } catch (err) {
      setState(prev => ({ ...prev, error: err as Error }));
    }
  }, [discoveryApi, fetchApi, getEntityDetails]);

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
