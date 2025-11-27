import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { discoveryApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  fetchSecretReferences,
  SecretReference,
} from '../api/secretReferences';

export interface UseSecretReferencesResult {
  secretReferences: SecretReference[];
  isLoading: boolean;
  error: string | null;
}

export function useSecretReferences(): UseSecretReferencesResult {
  const discovery = useApi(discoveryApiRef);
  const identity = useApi(identityApiRef);
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
        const response = await fetchSecretReferences(
          entity,
          discovery,
          identity,
        );
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
  }, [entity, discovery, identity]);

  return { secretReferences, isLoading, error };
}
