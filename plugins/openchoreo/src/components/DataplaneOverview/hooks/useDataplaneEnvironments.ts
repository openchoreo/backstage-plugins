import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';

export interface DataplaneEnvironment {
  name: string;
  displayName?: string;
  entityRef: string;
  isProduction: boolean;
  componentCount: number;
  healthStatus: 'healthy' | 'degraded' | 'error' | 'unknown';
}

interface UseDataplaneEnvironmentsResult {
  environments: DataplaneEnvironment[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useDataplaneEnvironments(
  dataplaneEntity: Entity,
): UseDataplaneEnvironmentsResult {
  const catalogApi = useApi(catalogApiRef);

  const dataplaneName = dataplaneEntity.metadata.name;
  const namespaceName =
    dataplaneEntity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    ['dataplane-environments', dataplaneName, namespaceName],
    async () => {
      // Narrows the annotation values to string (query is enabled only when
      // both are set) so the filter stays assignable to EntityFilterQuery.
      if (!dataplaneName || !namespaceName) return [];
      // Fetch Environment entities that reference this dataplane
      const { items: envEntities } = await catalogApi.getEntities({
        filter: {
          kind: 'Environment',
          [`metadata.annotations.${CHOREO_ANNOTATIONS.NAMESPACE}`]:
            namespaceName,
        },
      });

      // Filter environments that reference this dataplane
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
        componentCount: 0, // Would need additional API calls to get this
        healthStatus: 'unknown' as const, // Would need additional API calls
      }));

      return envList;
    },
    { enabled: !!dataplaneName && !!namespaceName },
  );

  return {
    environments: data ?? [],
    loading,
    isRefetching,
    error,
    refresh: refetch,
  };
}
