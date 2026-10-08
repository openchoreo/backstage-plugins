import type {
  BackstageIdentityApi,
  OAuthApi,
  ProfileInfoApi,
  SessionApi,
} from '@backstage/core-plugin-api';
import type { Observable } from '@backstage/types';
import type {
  OpenChoreoSessionState,
  OpenChoreoTokenApi,
  OpenChoreoTokenRequestOptions,
} from '@openchoreo/backstage-plugin-react';

type OpenChoreoOAuthApi = OAuthApi &
  ProfileInfoApi &
  BackstageIdentityApi &
  SessionApi;

/**
 * Default {@link OpenChoreoTokenApi}, sourcing the token from a Backstage
 * OAuth provider — `openchoreo-auth` unless the host points it elsewhere.
 *
 * Keeping the provider knowledge here means nothing else in the plugins has to
 * know *how* the token is obtained. A host whose existing session already
 * carries an OpenChoreo-accepted token can register its own implementation of
 * `openChoreoTokenApiRef` instead, without forking.
 */
export class OAuthOpenChoreoTokenApi implements OpenChoreoTokenApi {
  constructor(private readonly oauthApi: OpenChoreoOAuthApi) {}

  async getToken(
    options?: OpenChoreoTokenRequestOptions,
  ): Promise<string | undefined> {
    return this.oauthApi.getAccessToken(undefined, options);
  }

  async signIn(): Promise<void> {
    // instantPopup requires a user gesture; callers must invoke this from one.
    await this.oauthApi.getAccessToken(undefined, { instantPopup: true });
  }

  sessionState$(): Observable<OpenChoreoSessionState> {
    return this.oauthApi.sessionState$();
  }
}
