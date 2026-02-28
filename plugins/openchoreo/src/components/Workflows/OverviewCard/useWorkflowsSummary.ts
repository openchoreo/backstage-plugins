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
  const fetchApi = useApi(fetchApiRef);
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
      const { componentName, projectName, namespaceName } =
        await getEntityDetails();

      const componentBaseUrl = await discoveryApi.getBaseUrl('openchoreo');
      const workflowsBaseUrl = await discoveryApi.getBaseUrl(
        'openchoreo-workflows-backend',
      );

      const runsParams = new URLSearchParams({ namespaceName });
      if (projectName) runsParams.set('projectName', projectName);
      if (componentName) runsParams.set('componentName', componentName);

      // Fetch component details and workflow runs in parallel
      const [componentResponse, runsResponse] = await Promise.all([
        fetchApi.fetch(
          `${componentBaseUrl}/component?componentName=${encodeURIComponent(
            componentName,
          )}&projectName=${encodeURIComponent(
            projectName,
          )}&namespaceName=${encodeURIComponent(namespaceName)}`,
        ),
        fetchApi.fetch(
          `${workflowsBaseUrl}/workflow-runs?${runsParams.toString()}`,
        ),
      ]);

      if (!componentResponse.ok) {
        throw new Error(
          `HTTP ${componentResponse.status}: ${componentResponse.statusText}`,
        );
      }

      const componentData = await componentResponse.json();
      let latestBuild: ModelsBuild | null = null;

      if (!runsResponse.ok) {
        throw new Error(
          `Failed to fetch workflow runs: HTTP ${runsResponse.status}: ${runsResponse.statusText}`,
        );
      }

      const result = await runsResponse.json();
      const runs: ModelsBuild[] = (result.items || []).map((run: any) => ({
        name: run.name,
        uuid: run.uuid || '',
        componentName:
          run.labels?.[CHOREO_LABELS.WORKFLOW_COMPONENT] || componentName,
        projectName:
          run.labels?.[CHOREO_LABELS.WORKFLOW_PROJECT] || projectName,
        namespaceName: run.namespaceName,
        status: run.status,
        createdAt: run.createdAt,
      }));
      const sortedBuilds = [...runs].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
      latestBuild = sortedBuilds.length > 0 ? sortedBuilds[0] : null;

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
  }, [discoveryApi, fetchApi, getEntityDetails]);

  const triggerBuild = useCallback(async () => {
    setState(prev => ({ ...prev, triggeringBuild: true }));
    try {
      const { componentName, projectName, namespaceName } =
        await getEntityDetails();

      const workflow = state.componentDetails?.componentWorkflow;
      if (!workflow?.name) {
        throw new Error('No workflow configured for this component');
      }

      const baseUrl = await discoveryApi.getBaseUrl(
        'openchoreo-workflows-backend',
      );

      const response = await fetchApi.fetch(
        `${baseUrl}/workflow-runs?namespaceName=${encodeURIComponent(
          namespaceName,
        )}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workflowName: workflow.name,
            parameters: workflow.parameters,
            labels: {
              [CHOREO_LABELS.WORKFLOW_PROJECT]: projectName,
              [CHOREO_LABELS.WORKFLOW_COMPONENT]: componentName,
            },
          }),
        },
      );

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
  }, [
    discoveryApi,
    fetchApi,
    getEntityDetails,
    fetchData,
    state.componentDetails,
  ]);

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
