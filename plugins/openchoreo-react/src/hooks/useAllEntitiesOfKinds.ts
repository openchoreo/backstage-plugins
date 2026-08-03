import { CompoundEntityRef, DEFAULT_NAMESPACE } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useOpenChoreoQuery } from './useOpenChoreoQuery';

export function useAllEntitiesOfKinds(kinds: string[], namespaces?: string[]) {
  const catalogApi = useApi(catalogApiRef);

  const enabled = kinds.length > 0;

  const { data, loading, isRefetching, error } = useOpenChoreoQuery(
    ['all-entities-of-kinds', kinds.join(','), (namespaces ?? []).join(',')],
    async () => {
      if (kinds.length === 0) {
        return { entityRefs: [] as CompoundEntityRef[], entityCount: 0 };
      }

      const response = await catalogApi.getEntities({
        filter: {
          kind: kinds,
          ...(namespaces &&
            namespaces.length > 0 && {
              'metadata.namespace': namespaces,
            }),
        },
        fields: ['kind', 'metadata.name', 'metadata.namespace'],
      });

      const entityRefs: CompoundEntityRef[] = response.items.map(entity => ({
        kind: entity.kind,
        namespace: entity.metadata.namespace ?? DEFAULT_NAMESPACE,
        name: entity.metadata.name,
      }));

      return { entityRefs, entityCount: entityRefs.length };
    },
    { enabled },
  );

  return {
    entityRefs: data?.entityRefs ?? [],
    loading,
    isRefetching,
    error: error ?? undefined,
    entityCount: data?.entityCount ?? 0,
  };
}
