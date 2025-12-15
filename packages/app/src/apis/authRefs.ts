import { ApiRef, createApiRef, OAuthApi } from '@backstage/core-plugin-api';

/**
 * API reference for default-idp OIDC provider.
 * Separated to avoid circular dependencies with form decorators.
 */
export const defaultIdpAuthApiRef: ApiRef<OAuthApi> = createApiRef({
  id: 'auth.default-idp',
});
