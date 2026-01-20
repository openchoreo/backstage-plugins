import { useState, useEffect } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { useComponentEntityDetails } from '@openchoreo/backstage-plugin-react';

export interface WorkflowRunDetails {
  name: string;
  uuid: string;
  status?: string;
  commit?: string;
  image?: string;
  workflow?: {
    name: string;
    systemParameters?: {
      repository?: {
        url: string;
        appPath: string;
        revision?: {
          branch: string;
          commit?: string;
        };
      };
    };
    parameters?: Record<string, any>;
  };
  createdAt?: string;
}

interface UseWorkflowRunResult {
  workflowRun: WorkflowRunDetails | null;
  loading: boolean;
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

  const [workflowRun, setWorkflowRun] = useState<WorkflowRunDetails | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    if (!runName) {
      setLoading(false);
      return;
    }

    const fetchWorkflowRun = async () => {
      try {
        setLoading(true);
        setError(null);

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
          )}&runName=${encodeURIComponent(runName)}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setWorkflowRun(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflowRun();
  }, [runName, discoveryApi, fetchApi, getEntityDetails, refetchTrigger]);

  const refetch = () => {
    setRefetchTrigger(prev => prev + 1);
  };

  return {
    workflowRun,
    loading,
    error,
    refetch,
  };
}
