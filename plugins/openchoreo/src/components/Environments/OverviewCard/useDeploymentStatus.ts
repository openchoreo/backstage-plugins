import { stringifyEntityRef } from '@backstage/catalog-model';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { isForbiddenError } from '../../../utils/errorUtils';
import type { Environment } from '../hooks/useEnvironmentData';

/**
 * Poll while any environment has a NotReady or Failed deployment (these may
 * recover, so we keep refreshing until every environment settles).
 */
function shouldPoll(envs?: Environment[]): boolean {
  return !!envs?.some(
    e =>
      e.deployment?.status === 'NotReady' || e.deployment?.status === 'Failed',
  );
}

/**
 * Hook for fetching deployment status across all environments for the overview card.
 */
export function useDeploymentStatus() {
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    ['deployment-status', stringifyEntityRef(entity)],
    () => client.fetchEnvironmentInfo(entity) as Promise<Environment[]>,
    {
      refetchInterval: query => (shouldPoll(query.state.data) ? 10000 : false),
    },
  );

  return {
    environments: data ?? [],
    loading,
    error,
    isForbidden: isForbiddenError(error),
    // Background refresh with data already on screen — maps the old
    // manual-refresh `refreshing` flag onto the wrapper's isRefetching.
    refreshing: isRefetching,
    refresh: async () => {
      await refetch();
    },
  };
}
