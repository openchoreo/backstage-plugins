import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface Environment {
  name: string;
  displayName?: string;
  dnsPrefix?: string;
  isProduction: boolean;
}

interface UseEnvironmentsResult {
  environments: Environment[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
}

export function useEnvironments(systemEntity: Entity): UseEnvironmentsResult {
  const catalogApi = useApi(catalogApiRef);

  const namespace =
    systemEntity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  const { data, loading, isRefetching, error } = useOpenChoreoQuery(
    ['project-environments', stringifyEntityRef(systemEntity), namespace],
    async (): Promise<Environment[]> => {
      // Narrows `namespace` to string (the query is enabled only when set) and
      // keeps the filter value assignable to EntityFilterQuery.
      if (!namespace) return [];
      // Fetch Environment entities from catalog
      const { items } = await catalogApi.getEntities({
        filter: {
          kind: 'Environment',
          [`metadata.annotations.${CHOREO_ANNOTATIONS.NAMESPACE}`]: namespace,
        },
      });

      return items.map((entity: Entity) => ({
        name:
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ENVIRONMENT] ||
          entity.metadata.name,
        displayName: entity.metadata.title || entity.metadata.name,
        dnsPrefix: entity.metadata.annotations?.['openchoreo.io/dns-prefix'],
        isProduction:
          entity.metadata.annotations?.['openchoreo.io/is-production'] ===
          'true',
      }));
    },
    { enabled: !!namespace },
  );

  return {
    environments: data ?? [],
    loading,
    isRefetching,
    error,
  };
}
