import { useState, useEffect } from 'react';
import {
  useApi,
  identityApiRef,
  errorApiRef,
} from '@backstage/core-plugin-api';

/**
 * Hook to fetch the user's group memberships
 *
 * @returns An object containing:
 *  - userGroups: Array of group names the user belongs to
 *  - userName: The user's name
 *  - loading: Boolean indicating if the data is still loading
 *  - error: Error object if the fetch failed
 *
 * @example
 * const { userGroups, loading } = useUserGroups();
 * const isPlatformEngineer = userGroups.includes('platformengineer');
 */
export const useUserGroups = () => {
  const identityApi = useApi(identityApiRef);
  const errorApi = useApi(errorApiRef);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const identity = await identityApi.getBackstageIdentity();
        const ownershipRefs = identity.ownershipEntityRefs || [];
        // Extract group names from refs like "group:default/admins"
        const groups = ownershipRefs
          .filter(ref => ref.startsWith('group:'))
          .map(ref => ref.split('/')[1]);
        setUserGroups(groups);
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

  return { userGroups, userName, loading, error };
};
