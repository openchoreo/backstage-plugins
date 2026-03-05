import { useEffect, useState, useCallback } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { DataplaneEnvironment } from '../../DataplaneOverview/hooks';

interface UseClusterDataplaneEnvironmentsResult {
  environments: DataplaneEnvironment[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useClusterDataplaneEnvironments(
  dataplaneEntity: Entity,
): UseClusterDataplaneEnvironmentsResult {
  const catalogApi = useApi(catalogApiRef);

  const [environments, setEnvironments] = useState<DataplaneEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const dataplaneName = dataplaneEntity.metadata.name;

  const fetchEnvironments = useCallback(async () => {
    if (!dataplaneName) {
      setEnvironments([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch Environment entities that reference a ClusterDataPlane
      const { items: envEntities } = await catalogApi.getEntities({
        filter: {
          kind: 'Environment',
          [`metadata.annotations.${CHOREO_ANNOTATIONS.DATA_PLANE_REF_KIND}`]:
            'ClusterDataPlane',
        },
      });

      // Filter environments that reference this specific cluster dataplane
      const filteredEnvs = envEntities.filter(env => {
        const dataPlaneRef =
          env.metadata.annotations?.['openchoreo.io/data-plane-ref'];
        return dataPlaneRef === dataplaneName;
      });

      // Map to our interface
      const envList: DataplaneEnvironment[] = filteredEnvs.map(env => ({
        name:
          env.metadata.annotations?.[CHOREO_ANNOTATIONS.ENVIRONMENT] ||
          env.metadata.name,
        displayName: env.metadata.title || env.metadata.name,
        entityRef: `environment:${env.metadata.namespace || 'default'}/${
          env.metadata.name
        }`,
        isProduction:
          env.metadata.annotations?.['openchoreo.io/is-production'] === 'true',
        componentCount: 0,
        healthStatus: 'unknown' as const,
      }));

      setEnvironments(envList);
    } catch (err) {
      setError(err as Error);
      setEnvironments([]);
    } finally {
      setLoading(false);
    }
  }, [dataplaneName, catalogApi]);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const refresh = useCallback(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  return {
    environments,
    loading,
    error,
    refresh,
  };
}
