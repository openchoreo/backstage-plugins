import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { DataplaneEnvironment } from '../../DataplaneOverview/hooks';

interface UseClusterDataplaneEnvironmentsResult {
  environments: DataplaneEnvironment[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useClusterDataplaneEnvironments(
  dataplaneEntity: Entity,
): UseClusterDataplaneEnvironmentsResult {
  const catalogApi = useApi(catalogApiRef);

  const dataplaneName = dataplaneEntity.metadata.name;

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    ['cluster-dataplane-environments', dataplaneName],
    async () => {
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
      const envList: DataplaneEnvironment[] = filteredEnvs.map(env => {
        const ns = env.metadata.namespace || 'default';
        return {
          name:
            env.metadata.annotations?.[CHOREO_ANNOTATIONS.ENVIRONMENT] ||
            env.metadata.name,
          displayName: `${env.metadata.title || env.metadata.name} (${ns})`,
          entityRef: `environment:${ns}/${env.metadata.name}`,
          isProduction:
            env.metadata.annotations?.['openchoreo.io/is-production'] ===
            'true',
          componentCount: 0,
          healthStatus: 'unknown' as const,
        };
      });

      return envList;
    },
    { enabled: !!dataplaneName },
  );

  return {
    environments: data ?? [],
    loading,
    isRefetching,
    error,
    refresh: refetch,
  };
}
