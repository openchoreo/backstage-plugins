import { useCallback, useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  ComponentTrait,
} from '../../../api/OpenChoreoClientApi';

export const useTraitsData = () => {
  const { entity } = useEntity();
  const openChoreoClient = useApi(openChoreoClientApiRef);

  const [traits, setTraits] = useState<ComponentTrait[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTraits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await openChoreoClient.fetchComponentTraits(entity);
      setTraits(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [entity, openChoreoClient]);

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
