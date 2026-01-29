import { useState, useCallback, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  GitSecret,
} from '../../../api/OpenChoreoClientApi';

export interface UseGitSecretsResult {
  secrets: GitSecret[];
  loading: boolean;
  error: Error | null;
  fetchSecrets: () => Promise<void>;
  createSecret: (secretName: string, token: string) => Promise<GitSecret>;
  deleteSecret: (secretName: string) => Promise<void>;
}

export function useGitSecrets(namespaceName: string): UseGitSecretsResult {
  const [secrets, setSecrets] = useState<GitSecret[]>([]);
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
      const response = await client.listGitSecrets(namespaceName);
      setSecrets(response.items || []);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch git secrets'),
      );
      setSecrets([]);
    } finally {
      setLoading(false);
    }
  }, [client, namespaceName]);

  const createSecret = useCallback(
    async (secretName: string, token: string): Promise<GitSecret> => {
      const secret = await client.createGitSecret(
        namespaceName,
        secretName,
        token,
      );
      // Refresh the list
      await fetchSecrets();
      return secret;
    },
    [client, namespaceName, fetchSecrets],
  );

  const deleteSecret = useCallback(
    async (secretName: string): Promise<void> => {
      await client.deleteGitSecret(namespaceName, secretName);
      // Refresh the list
      await fetchSecrets();
    },
    [client, namespaceName, fetchSecrets],
  );

  // Fetch secrets when namespace changes
  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  return {
    secrets,
    loading,
    error,
    fetchSecrets,
    createSecret,
    deleteSecret,
  };
}
