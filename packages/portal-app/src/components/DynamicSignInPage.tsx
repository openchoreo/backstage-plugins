import { SignInPage } from '@backstage/core-components';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import type { SignInPageProps } from '@backstage/plugin-app-react';
import { openChoreoAuthApiRef } from '../apis/authRefs';

/**
 * Dynamic SignInPage that switches between OpenChoreo OIDC and guest mode
 * based on `openchoreo.features.auth.enabled`.
 *
 * - `auth.enabled = true`  (default): OpenChoreo IDP OAuth via the
 *   `openChoreoAuthApiRef`. The SignInPage shows a login button.
 * - `auth.enabled = false`: Backstage's built-in `guest` provider with
 *   `auto`, so we auto-sign-in.
 *
 * Mounted as an NFS `SignInPageBlueprint` extension (see
 * `apis/customOverrides.tsx`), replacing the legacy `createApp.components.
 * SignInPage` slot.
 */
export function DynamicSignInPage(props: SignInPageProps) {
  const configApi = useApi(configApiRef);
  const authEnabled =
    configApi.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;

  if (!authEnabled) {
    return <SignInPage {...props} auto providers={['guest']} />;
  }

  return (
    <SignInPage
      {...props}
      provider={{
        id: 'openchoreo-auth',
        title: 'OpenChoreo',
        message: 'Sign in using OpenChoreo',
        apiRef: openChoreoAuthApiRef,
      }}
    />
  );
}

export default DynamicSignInPage;
