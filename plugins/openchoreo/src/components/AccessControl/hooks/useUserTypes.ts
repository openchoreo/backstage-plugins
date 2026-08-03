import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
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
  if (!userType || !userType.authMechanisms?.length) return '';
  // Currently uses first auth mechanism - see TODO above for future enhancements
  return userType.authMechanisms[0].entitlement.claim;
}

export function getEntitlementDisplayName(
  userType: UserTypeConfig | undefined,
): string {
  if (!userType || !userType.authMechanisms?.length) return '';
  return userType.authMechanisms[0].entitlement.displayName;
}

interface UseUserTypesResult {
  userTypes: UserTypeConfig[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
  fetchUserTypes: () => Promise<void>;
}

export function useUserTypes(): UseUserTypesResult {
  const client = useApi(openChoreoClientApiRef);

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    ['user-types'],
    () => client.listUserTypes(),
  );

  return {
    userTypes: data ?? [],
    loading,
    isRefetching,
    error,
    fetchUserTypes: async () => {
      await refetch();
    },
  };
}
