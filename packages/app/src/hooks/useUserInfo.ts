import { useState, useEffect } from 'react';
import {
  useApi,
  identityApiRef,
  errorApiRef,
} from '@backstage/core-plugin-api';

export const useUserInfo = () => {
  const identityApi = useApi(identityApiRef);
  const errorApi = useApi(errorApiRef);
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const identity = await identityApi.getBackstageIdentity();
        setUserName(identity.userEntityRef.split('/')[1]);
      } catch (err) {
        const errorObj =
          err instanceof Error ? err : new Error('Failed to load user info');
        setError(errorObj);
        errorApi.post(errorObj);
      } finally {
        setLoading(false);
      }
    };

    loadUserInfo();
  }, [identityApi, errorApi]);

  return { userName, loading, error };
};
