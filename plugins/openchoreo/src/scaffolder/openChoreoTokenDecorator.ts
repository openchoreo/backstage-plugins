import { createScaffolderFormDecorator } from '@backstage/plugin-scaffolder-react/alpha';
import { configApiRef } from '@backstage/core-plugin-api';
import { openChoreoAuthApiRef } from '../api/authRefs';

/**
 * Form decorator that injects the signed-in user's OpenChoreo IDP token
 * as a template secret (`OPENCHOREO_USER_TOKEN`). Templates opt in via
 * their spec:
 *
 * ```yaml
 * spec:
 *   EXPERIMENTAL_formDecorators:
 *     - id: openchoreo:inject-user-token
 * ```
 *
 * The scaffolder backend reads the secret and presents it to the
 * OpenChoreo API so writes are attributed to (and authorized for) the
 * real user, not a shared service account. When
 * `openchoreo.features.auth.enabled` is false the decorator is a no-op —
 * an auth-disabled cluster doesn't issue user tokens.
 *
 * The decorator is registered as an extension by the base plugin (see
 * `alpha.tsx`), so adopters installing `openchoreoPluginAlpha` get it
 * automatically. Templates that reference the id but don't have this
 * plugin installed fail at submission with "Failed to find form decorator
 * openchoreo:inject-user-token" (upstream error, not ours).
 */
export const openChoreoTokenDecorator = createScaffolderFormDecorator({
  id: 'openchoreo:inject-user-token',
  deps: { oauthApi: openChoreoAuthApiRef, configApi: configApiRef },
  async decorator({ setSecrets }, { oauthApi, configApi }) {
    const authEnabled =
      configApi.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;

    if (!authEnabled) {
      // Auth-disabled cluster — no user token to inject.
      return;
    }

    const token = await oauthApi.getAccessToken();
    if (!token) {
      throw new Error(
        'Failed to get authentication token. Ensure you are logged in.',
      );
    }
    setSecrets(state => ({
      ...state,
      OPENCHOREO_USER_TOKEN: token,
    }));
  },
});
