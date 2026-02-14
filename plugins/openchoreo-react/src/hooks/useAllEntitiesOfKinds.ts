import { useCallback, useEffect, useState } from 'react';
import { CompoundEntityRef, DEFAULT_NAMESPACE } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

export function useAllEntitiesOfKinds(kinds: string[], namespace?: string) {
  const catalogApi = useApi(catalogApiRef);
  const [entityRefs, setEntityRefs] = useState<CompoundEntityRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();
  const [entityCount, setEntityCount] = useState(0);

  const kindsKey = kinds.join(',');

  const fetchEntities = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);

      const response = await catalogApi.getEntities({
        filter: {
          kind: kinds,
          ...(namespace && { 'metadata.namespace': namespace }),
        },
        fields: ['kind', 'metadata.name', 'metadata.namespace'],
      });

      const refs: CompoundEntityRef[] = response.items.map(entity => ({
        kind: entity.kind,
        namespace: entity.metadata.namespace ?? DEFAULT_NAMESPACE,
        name: entity.metadata.name,
      }));

      setEntityRefs(refs);
      setEntityCount(refs.length);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogApi, kindsKey, namespace]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  return { entityRefs, loading, error, entityCount };
}
