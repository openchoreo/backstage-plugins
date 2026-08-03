import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { useComponentEntityDetails } from '@openchoreo/backstage-plugin-react';
import type {
  ModelsBuild,
  ModelsCompleteComponent,
} from '@openchoreo/backstage-plugin-common';
import { CHOREO_LABELS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';

const POLLING_INTERVAL = 5000; // 5 seconds

/** True while any build is still pending/running — drives the builds poll. */
function hasActiveBuilds(builds?: ModelsBuild[]): boolean {
  return !!builds?.some(build => {
    const status = build.status?.toLowerCase() || '';
    return (
      status.includes('pending') ||
      status.includes('running') ||
      status.includes('progress')
    );
  });
}

/**
 * Hook for fetching and managing workflow data (builds and component details).
 * Includes automatic polling for active builds.
 *
 * Component details and builds are two independent cached queries with
 * different error semantics: a failed component fetch resolves to `null` (so
 * the UI shows "Workflows Not Available" instead of an error), while a failed
 * builds fetch surfaces in `error`. Only the builds query polls, and only while
 * a build is active.
 */
export function useWorkflowData() {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const { getEntityDetails } = useComponentEntityDetails();
  const entityRef = stringifyEntityRef(entity);

  const { data: componentDetails, refetch: refetchComponentDetails } =
    useOpenChoreoQuery<ModelsCompleteComponent | null>(
      ['workflow-data', 'component', entityRef],
      async () => {
        // Errors here are swallowed to `null` so the UI degrades to "Workflows
        // Not Available" rather than surfacing a raw HTTP error.
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
          return (await response.json()) as ModelsCompleteComponent;
        } catch {
          return null;
        }
      },
    );

  const {
    data: builds,
    loading: buildsLoading,
    isRefetching: buildsRefetching,
    error,
    refetch: refetchBuildsQuery,
  } = useOpenChoreoQuery<ModelsBuild[]>(
    ['workflow-data', 'builds', entityRef],
    async () => {
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
      // Map WorkflowRun items to ModelsBuild shape for UI compatibility.
      return (result.items || []).map((run: any) => ({
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
      }));
    },
    {
      refetchInterval: query =>
        hasActiveBuilds(query.state.data) ? POLLING_INTERVAL : false,
    },
  );

  return {
    builds: builds ?? [],
    componentDetails: componentDetails ?? null,
    // Gate the card skeleton on the builds fetch (the primary content); the
    // component-details query degrades to null silently and shouldn't hold the
    // whole card on a skeleton.
    loading: buildsLoading,
    isRefetching: buildsRefetching,
    error,
    fetchBuilds: async () => {
      await refetchBuildsQuery();
    },
    fetchComponentDetails: async () => {
      await refetchComponentDetails();
    },
  };
}
