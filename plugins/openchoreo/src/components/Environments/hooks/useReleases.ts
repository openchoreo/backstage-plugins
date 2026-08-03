import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

export interface UseReleasesResult {
  releases: ComponentRelease[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const getCreationTime = (release: ComponentRelease): number => {
  const ts = release.metadata?.creationTimestamp;
  return ts ? new Date(ts).getTime() : 0;
};

/**
 * Fetches the list of ComponentReleases for a component, newest first.
 */
export const useReleases = (entity: Entity): UseReleasesResult => {
  const client = useApi(openChoreoClientApiRef);

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    ['releases', stringifyEntityRef(entity)],
    async (): Promise<ComponentRelease[]> => {
      const response = await client.listComponentReleases(entity);
      const items = response.data?.items ?? [];
      return [...items].sort((a, b) => getCreationTime(b) - getCreationTime(a));
    },
  );

  return {
    releases: data ?? [],
    loading,
    isRefetching,
    error: error ? error.message || 'Failed to load releases' : null,
    refetch: async () => {
      await refetch();
    },
  };
};
