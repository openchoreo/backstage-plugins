import { useEffect, useState, useCallback } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
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
  error: Error | null;
}

export function useEnvironments(systemEntity: Entity): UseEnvironmentsResult {
  const catalogApi = useApi(catalogApiRef);

  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEnvironments = useCallback(async () => {
    const namespace =
      systemEntity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

    if (!namespace) {
      setEnvironments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch Environment entities from catalog
      const { items } = await catalogApi.getEntities({
        filter: {
          kind: 'Environment',
          [`metadata.annotations.${CHOREO_ANNOTATIONS.NAMESPACE}`]: namespace,
        },
      });

      const envList: Environment[] = items.map((entity: Entity) => ({
        name:
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ENVIRONMENT] ||
          entity.metadata.name,
        displayName: entity.metadata.title || entity.metadata.name,
        dnsPrefix: entity.metadata.annotations?.['openchoreo.io/dns-prefix'],
        isProduction:
          entity.metadata.annotations?.['openchoreo.io/is-production'] ===
          'true',
      }));

      setEnvironments(envList);
    } catch (err) {
      setError(err as Error);
      setEnvironments([]);
    } finally {
      setLoading(false);
    }
  }, [systemEntity, catalogApi]);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  return {
    environments,
    loading,
    error,
  };
}
