import { useCallback, useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { discoveryApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { fetchComponentTraits, ComponentTrait } from '../../../api/traits';

export const useTraitsData = () => {
  const { entity } = useEntity();
  const discovery = useApi(discoveryApiRef);
  const identity = useApi(identityApiRef);

  const [traits, setTraits] = useState<ComponentTrait[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTraits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchComponentTraits(entity, discovery, identity);
      setTraits(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [entity, discovery, identity]);

  useEffect(() => {
    fetchTraits();
  }, [fetchTraits]);

  return {
    traits,
    loading,
    error,
    refetch: fetchTraits,
  };
};
