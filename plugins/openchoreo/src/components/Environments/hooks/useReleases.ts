import { useCallback, useEffect, useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

export interface UseReleasesResult {
  releases: ComponentRelease[];
  loading: boolean;
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
  const [releases, setReleases] = useState<ComponentRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReleases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await client.listComponentReleases(entity);
      const items = response.data?.items ?? [];
      const sorted = [...items].sort(
        (a, b) => getCreationTime(b) - getCreationTime(a),
      );
      setReleases(sorted);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Failed to load releases';
      setError(message);
      setReleases([]);
    } finally {
      setLoading(false);
    }
  }, [client, entity]);

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  return { releases, loading, error, refetch: fetchReleases };
};
