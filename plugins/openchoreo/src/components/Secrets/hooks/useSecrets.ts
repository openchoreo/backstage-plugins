import { useState, useCallback, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  CreateSecretRequest,
  Secret,
} from '../../../api/OpenChoreoClientApi';
import { isForbiddenError } from '../../../utils/errorUtils';

export interface UseSecretsResult {
  secrets: Secret[];
  loading: boolean;
  error: Error | null;
  isForbidden: boolean;
  fetchSecrets: () => Promise<void>;
  createSecret: (request: CreateSecretRequest) => Promise<Secret>;
  deleteSecret: (secretName: string) => Promise<void>;
}

export function useSecrets(namespaceName: string): UseSecretsResult {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = useApi(openChoreoClientApiRef);

  const fetchSecrets = useCallback(async () => {
    if (!namespaceName) {
      setSecrets([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await client.listSecrets(namespaceName);
      setSecrets(response.items || []);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch secrets'),
      );
      setSecrets([]);
    } finally {
      setLoading(false);
    }
  }, [client, namespaceName]);

  const createSecret = useCallback(
    async (request: CreateSecretRequest): Promise<Secret> => {
      const secret = await client.createSecret(namespaceName, request);
      await fetchSecrets();
      return secret;
    },
    [client, namespaceName, fetchSecrets],
  );

  const deleteSecret = useCallback(
    async (secretName: string): Promise<void> => {
      await client.deleteSecret(namespaceName, secretName);
      await fetchSecrets();
    },
    [client, namespaceName, fetchSecrets],
  );

  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  return {
    secrets,
    loading,
    error,
    isForbidden: isForbiddenError(error),
    fetchSecrets,
    createSecret,
    deleteSecret,
  };
}
