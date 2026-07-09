import { useApi } from '@backstage/core-plugin-api';
import {
  useOpenChoreoMutation,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';
import {
  openChoreoClientApiRef,
  CreateSecretRequest,
  UpdateSecretRequest,
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
  updateSecret: (
    secretName: string,
    request: UpdateSecretRequest,
  ) => Promise<Secret>;
  deleteSecret: (secretName: string) => Promise<void>;
}

export function useSecrets(namespaceName: string): UseSecretsResult {
  const client = useApi(openChoreoClientApiRef);
  const secretsKey = ['secrets', namespaceName];

  const { data, loading, error, refetch } = useOpenChoreoQuery(
    secretsKey,
    async () => {
      try {
        const response = await client.listSecrets(namespaceName);
        return response.items ?? [];
      } catch (err) {
        // Normalise non-Error rejections so `error` is always an Error with a
        // usable message (matches the pre-cache hand-rolled behaviour).
        throw err instanceof Error
          ? err
          : new Error('Failed to fetch secrets');
      }
    },
    { enabled: !!namespaceName },
  );

  // Each write invalidates the list so it refreshes from one call — replaces
  // the hand-rolled `await fetchSecrets()` that used to follow every mutation.
  const { mutate: createSecret } = useOpenChoreoMutation<
    [CreateSecretRequest],
    Secret
  >(request => client.createSecret(namespaceName, request), {
    invalidates: [secretsKey],
  });

  const { mutate: updateSecret } = useOpenChoreoMutation<
    [string, UpdateSecretRequest],
    Secret
  >(
    (secretName, request) =>
      client.updateSecret(namespaceName, secretName, request),
    { invalidates: [secretsKey] },
  );

  const { mutate: deleteSecret } = useOpenChoreoMutation<[string], void>(
    secretName => client.deleteSecret(namespaceName, secretName),
    { invalidates: [secretsKey] },
  );

  return {
    secrets: data ?? [],
    loading,
    error,
    isForbidden: isForbiddenError(error),
    fetchSecrets: async () => {
      refetch();
    },
    createSecret,
    updateSecret,
    deleteSecret,
  };
}
