import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  useComponentEntityDetails,
  useOpenChoreoQuery,
  useOpenChoreoMutation,
} from '@openchoreo/backstage-plugin-react';
import type {
  ModelsBuild,
  ModelsCompleteComponent,
} from '@openchoreo/backstage-plugin-common';
import { CHOREO_LABELS } from '@openchoreo/backstage-plugin-common';

interface WorkflowsSummaryData {
  latestBuild: ModelsBuild | null;
  componentDetails: ModelsCompleteComponent | null;
}

/**
 * Poll while the latest build is in a non-terminal state (pending/running/
 * in-progress), so the card reflects live build progress.
 */
function isBuildActive(build?: ModelsBuild | null): boolean {
  const status = build?.status?.toLowerCase() || '';
  return (
    status.includes('pending') ||
    status.includes('running') ||
    status.includes('progress')
  );
}

/**
 * Simplified hook for fetching workflow summary data for the overview card.
 * Fetches component details and latest build only.
 */
export function useWorkflowsSummary() {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const { getEntityDetails } = useComponentEntityDetails();

  const queryKey = ['workflows-summary', stringifyEntityRef(entity)];

  const { data, loading, isRefetching, error, refetch } =
    useOpenChoreoQuery<WorkflowsSummaryData>(
      queryKey,
      async () => {
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
          commit: run.commit,
        }));
        const sortedBuilds = [...runs].sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        );
        const latestBuild = sortedBuilds.length > 0 ? sortedBuilds[0] : null;

        return {
          latestBuild,
          componentDetails: componentData as ModelsCompleteComponent,
        };
      },
      {
        refetchInterval: query =>
          isBuildActive(query.state.data?.latestBuild) ? 5000 : false,
      },
    );

  const triggerMutation = useOpenChoreoMutation<[], void>(
    async () => {
      const { componentName, projectName, namespaceName } =
        await getEntityDetails();

      const workflow = data?.componentDetails?.componentWorkflow;
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
            workflowRunName: `${componentName}-${Date.now()}`,
            workflowName: workflow.name,
            workflowKind: workflow.kind ?? 'Workflow',
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
    },
    { invalidates: [queryKey] },
  );

  // The card wires triggerBuild straight to onClick with no try/catch, and the
  // original hook swallowed the failure into its error state. Keep that: catch
  // here so a failed POST doesn't become an unhandled rejection — the error is
  // still surfaced via `triggerMutation.error`.
  const triggerBuild = async () => {
    try {
      await triggerMutation.mutate();
    } catch {
      // Surfaced through `error` below.
    }
  };

  return {
    latestBuild: data?.latestBuild ?? null,
    componentDetails: data?.componentDetails ?? null,
    hasWorkflows: Boolean(data?.componentDetails?.componentWorkflow?.name),
    loading,
    isRefetching,
    error: error ?? triggerMutation.error,
    triggeringBuild: triggerMutation.isLoading,
    triggerBuild,
    refresh: async () => {
      await refetch();
    },
  };
}
