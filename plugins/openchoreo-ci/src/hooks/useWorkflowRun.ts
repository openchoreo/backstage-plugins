import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import {
  useComponentEntityDetails,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';

export interface WorkflowRunDetails {
  name: string;
  uuid: string;
  status?: string;
  commit?: string;
  image?: string;
  workflow?: {
    name: string;
    parameters?: Record<string, any>;
  };
  createdAt?: string;
  workloadCr?: string;
  workloadFromSource?: string;
  startedAt?: string;
  completedAt?: string;
}

interface UseWorkflowRunResult {
  workflowRun: WorkflowRunDetails | null;
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook for fetching workflow run details including parameters
 * @param runName - The name of the workflow run to fetch
 * @returns Workflow run details, loading state, error, and refetch function
 */
export function useWorkflowRun(runName?: string): UseWorkflowRunResult {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const { getEntityDetails } = useComponentEntityDetails();

  const { data, loading, isRefetching, error, refetch } =
    useOpenChoreoQuery<WorkflowRunDetails>(
      ['workflow-run', runName ?? null],
      async () => {
        const { componentName, projectName, namespaceName } =
          await getEntityDetails();
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo-ci-backend');

        const response = await fetchApi.fetch(
          `${baseUrl}/workflow-run?componentName=${encodeURIComponent(
            componentName,
          )}&projectName=${encodeURIComponent(
            projectName,
          )}&namespaceName=${encodeURIComponent(
            namespaceName,
          )}&runName=${encodeURIComponent(runName as string)}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return (await response.json()) as WorkflowRunDetails;
      },
      { enabled: !!runName },
    );

  return {
    workflowRun: data ?? null,
    loading,
    isRefetching,
    error,
    refetch,
  };
}
