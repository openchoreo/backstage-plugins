import { createScaffolderFormDecorator } from '@backstage/plugin-scaffolder-react/alpha';
import { configApiRef } from '@backstage/core-plugin-api';
import { openChoreoAuthApiRef } from '../api/authRefs';

// Injects the signed-in user's IDP token as OPENCHOREO_USER_TOKEN. Templates
// opt in with `EXPERIMENTAL_formDecorators: [{ id: openchoreo:inject-user-token }]`.
// No-op when the cluster runs with auth disabled.
export const openChoreoTokenDecorator = createScaffolderFormDecorator({
  id: 'openchoreo:inject-user-token',
  deps: { oauthApi: openChoreoAuthApiRef, configApi: configApiRef },
  async decorator({ setSecrets }, { oauthApi, configApi }) {
    const authEnabled =
      configApi.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;
    if (!authEnabled) return;

    const token = await oauthApi.getAccessToken();
    if (!token) {
      throw new Error(
        'Failed to get authentication token. Ensure you are logged in.',
      );
    }
    setSecrets(state => ({ ...state, OPENCHOREO_USER_TOKEN: token }));
  },
});
