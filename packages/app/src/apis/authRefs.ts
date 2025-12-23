import {
  ApiRef,
  createApiRef,
  OAuthApi,
  ProfileInfoApi,
  SessionApi,
} from '@backstage/core-plugin-api';

/**
 * API reference for OpenChoreo authentication provider.
 * Works with any OIDC-compliant identity provider configured in OpenChoreo.
 * Separated to avoid circular dependencies with form decorators.
 */
export const openChoreoAuthApiRef: ApiRef<
  OAuthApi & ProfileInfoApi & SessionApi
> = createApiRef({
  id: 'auth.openchoreo-auth',
});
