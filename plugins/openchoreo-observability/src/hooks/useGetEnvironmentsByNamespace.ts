import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { Environment } from '../types';

export interface UseGetEnvironmentsByNamespaceResult {
  environments: Environment[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch environments for a specific namespace from the observability backend.
 *
 * When `projectName` is supplied, the backend restricts the result to the
 * environments defined by that project's deployment pipeline, so a project
 * with an empty pipeline yields no environments (matching the Deploy tab).
 *
 * @param namespaceName - The name of the namespace to fetch environments for
 * @param projectName - Optional project whose deployment pipeline scopes the result
 * @returns Object containing environments array, loading state, and error
 */
export const useGetEnvironmentsByNamespace = (
  namespaceName: string | undefined,
  projectName?: string,
): UseGetEnvironmentsByNamespaceResult => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnvironments = async () => {
      if (!namespaceName) {
        setLoading(false);
        setError('Namespace name is required');
        setEnvironments([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const baseUrl = await discoveryApi.getBaseUrl(
          'openchoreo-observability-backend',
        );
        const query = new URLSearchParams({ namespace: namespaceName });
        if (projectName) {
          query.set('project', projectName);
        }
        const response = await fetchApi.fetch(
          `${baseUrl}/environments?${query.toString()}`,
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch environments: ${response.status} ${response.statusText}`,
          );
        }

        const data = await response.json();
        setEnvironments(data.environments || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch environments',
        );
        setEnvironments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEnvironments();
  }, [namespaceName, projectName, discoveryApi, fetchApi]);

  return { environments, loading, error };
};
