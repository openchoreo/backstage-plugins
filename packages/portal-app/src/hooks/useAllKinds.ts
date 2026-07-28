import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

export function useAllKinds(): {
  allKinds: Map<string, string>;
  loading: boolean;
  error?: Error;
} {
  const catalogApi = useApi(catalogApiRef);
  const [allKinds, setAllKinds] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    let isMounted = true;

    const fetchKinds = async () => {
      try {
        setLoading(true);
        const { items } = await catalogApi.getEntities({
          fields: ['kind'],
        });

        if (!isMounted) return;

        const kindsSet = new Set<string>();
        items.forEach(entity => {
          if (entity.kind) {
            kindsSet.add(entity.kind);
          }
        });

        const kindsMap = new Map<string, string>();
        kindsSet.forEach(kind => {
          kindsMap.set(kind, kind);
        });

        setAllKinds(kindsMap);
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        setError(err as Error);
        setLoading(false);
      }
    };

    fetchKinds();

    return () => {
      isMounted = false;
    };
  }, [catalogApi]);

  return { allKinds, loading, error };
}
