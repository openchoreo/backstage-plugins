import { createApiRef } from '@backstage/core-plugin-api';
import type { Observable } from '@backstage/types';

/**
 * Options for {@link OpenChoreoTokenApi.getToken}.
 */
export interface OpenChoreoTokenRequestOptions {
  /**
   * When true, resolve to `undefined` instead of prompting the user to
   * authenticate. Use this for background/data fetches that should degrade
   * rather than interrupt the user with a login popup.
   */
  optional?: boolean;
}

/**
 * Session state of the OpenChoreo identity, mirroring Backstage's
 * `SessionState` without coupling callers to a specific auth provider.
 */
export type OpenChoreoSessionState = 'SignedIn' | 'SignedOut';

/**
 * Supplies the access token that the OpenChoreo API accepts for the current
 * user.
 *
 * This is deliberately a *capability*, not a Backstage auth provider: how the
 * token is obtained is an implementation detail. The default implementation
 * (registered by `@openchoreo/backstage-plugin`) sources it from the
 * `openchoreo-auth` OAuth provider, but a host whose own session already
 * carries an OpenChoreo-accepted token can override this API instead of
 * forking the plugins.
 */
export interface OpenChoreoTokenApi {
  /**
   * Resolves the current user's OpenChoreo access token, or `undefined` when
   * authentication is disabled or (with `optional: true`) no session exists.
   */
  getToken(
    options?: OpenChoreoTokenRequestOptions,
  ): Promise<string | undefined>;

  /**
   * Establishes an OpenChoreo session, prompting the user if necessary.
   *
   * Must be called from a user gesture — browsers block the authentication
   * popup otherwise.
   */
  signIn(): Promise<void>;

  /**
   * Observes whether an OpenChoreo session currently exists, so UI can offer a
   * sign-in affordance instead of letting a fetch fail.
   */
  sessionState$(): Observable<OpenChoreoSessionState>;
}

/**
 * API reference for {@link OpenChoreoTokenApi}.
 */
export const openChoreoTokenApiRef = createApiRef<OpenChoreoTokenApi>({
  id: 'openchoreo.token',
});
