import { useState, useCallback, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  UserTypeInfo,
  SubjectType,
  EntitlementClaimInfo,
} from '../../../api/OpenChoreoClientApi';

export type { UserTypeInfo, SubjectType, EntitlementClaimInfo };

interface UseUserTypesResult {
  userTypes: UserTypeInfo[];
  loading: boolean;
  error: Error | null;
  fetchUserTypes: () => Promise<void>;
}

export function useUserTypes(): UseUserTypesResult {
  const [userTypes, setUserTypes] = useState<UserTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const client = useApi(openChoreoClientApiRef);

  const fetchUserTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await client.listUserTypes();
      setUserTypes(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchUserTypes();
  }, [fetchUserTypes]);

  return {
    userTypes,
    loading,
    error,
    fetchUserTypes,
  };
}
