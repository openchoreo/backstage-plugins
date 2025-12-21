import { useState, useCallback, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  openChoreoClientApiRef,
  UserTypeConfig,
  SubjectType,
  EntitlementConfig,
  AuthMechanismConfig,
} from '../../../api/OpenChoreoClientApi';

export type {
  UserTypeConfig,
  SubjectType,
  EntitlementConfig,
  AuthMechanismConfig,
};

/**
 * Extracts the entitlement claim from a UserTypeConfig.
 *
 * TODO: Currently uses the first auth mechanism. Future options:
 * - Filter by specific type (e.g., type === 'jwt')
 * - Support multiple auth mechanisms in UI
 */
export function getEntitlementClaim(
  userType: UserTypeConfig | undefined,
): string {
  if (!userType || !userType.auth_mechanisms?.length) return '';
  // Currently uses first auth mechanism - see TODO above for future enhancements
  return userType.auth_mechanisms[0].entitlement.claim;
}

export function getEntitlementDisplayName(
  userType: UserTypeConfig | undefined,
): string {
  if (!userType || !userType.auth_mechanisms?.length) return '';
  return userType.auth_mechanisms[0].entitlement.display_name;
}

interface UseUserTypesResult {
  userTypes: UserTypeConfig[];
  loading: boolean;
  error: Error | null;
  fetchUserTypes: () => Promise<void>;
}

export function useUserTypes(): UseUserTypesResult {
  const [userTypes, setUserTypes] = useState<UserTypeConfig[]>([]);
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
