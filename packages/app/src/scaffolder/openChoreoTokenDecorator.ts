import { createScaffolderFormDecorator } from '@backstage/plugin-scaffolder-react/alpha';
import { configApiRef } from '@backstage/core-plugin-api';
import { defaultIdpAuthApiRef } from '../apis/authRefs';

/**
 * Form decorator that injects the user's OpenChoreo IDP token as a secret.
 *
 * This decorator runs before form submission and:
 * 1. Retrieves the user's OAuth access token from the IDP
 * 2. Injects it as OPENCHOREO_USER_TOKEN secret
 * 3. The scaffolder backend can then use this token for user-based authorization
 *
 * Templates that need user authorization should include this decorator:
 * ```yaml
 * spec:
 *   EXPERIMENTAL_formDecorators:
 *     - id: openchoreo:inject-user-token
 * ```
 */
export const openChoreoTokenDecorator = createScaffolderFormDecorator({
  id: 'openchoreo:inject-user-token',
  deps: { oauthApi: defaultIdpAuthApiRef, configApi: configApiRef },
  async decorator({ setSecrets }, { oauthApi, configApi }) {
    // Check if authorization is enabled (defaults to true)
    const authzEnabled =
      configApi.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;

    if (!authzEnabled) {
      // Skip token injection when authz is disabled
      return;
    }

    const token = await oauthApi.getAccessToken();
    if (!token) {
      throw new Error(
        'Failed to get authentication token. Please ensure you are logged in.',
      );
    }
    setSecrets(state => ({
      ...state,
      OPENCHOREO_USER_TOKEN: token,
    }));
  },
});
