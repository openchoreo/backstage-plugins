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

interface WorkflowsSummaryState {
  latestBuild: ModelsBuild | null;
  componentDetails: ModelsCompleteComponent | null;
  loading: boolean;
  error: Error | null;
  triggeringBuild: boolean;
}

/**
 * Simplified hook for fetching workflow summary data for the overview card.
 * Fetches component details and latest build only.
 */
export function useWorkflowsSummary() {
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const { getEntityDetails } = useComponentEntityDetails();

  const [state, setState] = useState<WorkflowsSummaryState>({
    latestBuild: null,
    componentDetails: null,
    loading: true,
    error: null,
    triggeringBuild: false,
  });

  const fetchData = useCallback(async () => {
    try {
      const { componentName, projectName, organizationName } =
        await getEntityDetails();

      const { token } = await identityApi.getCredentials();
      const baseUrl = await discoveryApi.getBaseUrl('openchoreo');

      // Fetch component details and builds in parallel
      const [componentResponse, buildsResponse] = await Promise.all([
        fetch(
          `${baseUrl}/component?componentName=${encodeURIComponent(
            componentName,
          )}&projectName=${encodeURIComponent(
            projectName,
          )}&organizationName=${encodeURIComponent(organizationName)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
        fetch(
          `${baseUrl}/builds?componentName=${encodeURIComponent(
            componentName,
          )}&projectName=${encodeURIComponent(
            projectName,
          )}&organizationName=${encodeURIComponent(organizationName)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      ]);

      if (!componentResponse.ok) {
        throw new Error(
          `HTTP ${componentResponse.status}: ${componentResponse.statusText}`,
        );
      }

      const componentData = await componentResponse.json();
      let latestBuild: ModelsBuild | null = null;

      if (buildsResponse.ok) {
        const buildsData: ModelsBuild[] = await buildsResponse.json();
        const sortedBuilds = [...buildsData].sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        );
        // Get the latest build (first in array, sorted by createdAt desc)
        latestBuild = sortedBuilds.length > 0 ? sortedBuilds[0] : null;
      }

      setState(prev => ({
        ...prev,
        componentDetails: componentData,
        latestBuild,
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
  }, [discoveryApi, identityApi, getEntityDetails]);

  const triggerBuild = useCallback(async () => {
    setState(prev => ({ ...prev, triggeringBuild: true }));
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

      // Refresh data after triggering build
      await fetchData();
    } catch (err) {
      setState(prev => ({ ...prev, error: err as Error }));
    } finally {
      setState(prev => ({ ...prev, triggeringBuild: false }));
    }
  }, [discoveryApi, identityApi, getEntityDetails, fetchData]);

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    await fetchData();
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll if latest build is active
  useEffect(() => {
    if (!state.latestBuild) return undefined;

    const status = state.latestBuild.status?.toLowerCase() || '';
    const isActive =
      status.includes('pending') ||
      status.includes('running') ||
      status.includes('progress');

    if (!isActive) return undefined;

    const intervalId = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [state.latestBuild, fetchData]);

  // Check if workflows are enabled for this component
  const hasWorkflows = Boolean(state.componentDetails?.componentWorkflow?.name);

  return {
    latestBuild: state.latestBuild,
    componentDetails: state.componentDetails,
    hasWorkflows,
    loading: state.loading,
    error: state.error,
    triggeringBuild: state.triggeringBuild,
    triggerBuild,
    refresh,
  };
}
