import { createScaffolderFormDecorator } from '@backstage/plugin-scaffolder-react/alpha';
import { defaultIdpAuthApiRef } from '../apis';

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
  deps: { oauthApi: defaultIdpAuthApiRef },
  async decorator({ setSecrets }, { oauthApi }) {
    try {
      const token = await oauthApi.getAccessToken();
      if (token) {
        setSecrets(state => ({
          ...state,
          OPENCHOREO_USER_TOKEN: token,
        }));
      }
    } catch {
      // Continue without token if not available (e.g., guest mode)
      // The scaffolder action will fall back to service token
    }
  },
});
