import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  openChoreoClientApiRef,
  SecretReference,
} from '../api/OpenChoreoClientApi';

export interface UseSecretReferencesResult {
  secretReferences: SecretReference[];
  isLoading: boolean;
  error: string | null;
}

export function useSecretReferences(): UseSecretReferencesResult {
  const client = useApi(openChoreoClientApiRef);
  const { entity } = useEntity();
  const [secretReferences, setSecretReferences] = useState<SecretReference[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSecrets = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await client.fetchSecretReferences(entity);
        if (response.success && response.data.items) {
          setSecretReferences(response.data.items);
        }
      } catch (err) {
        setError('Failed to fetch secret references');
        setSecretReferences([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSecrets();

    return () => {
      setSecretReferences([]);
      setError(null);
    };
  }, [entity, client]);

  return { secretReferences, isLoading, error };
}
