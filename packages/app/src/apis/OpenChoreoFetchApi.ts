import {
  ConfigApi,
  FetchApi,
  IdentityApi,
  OAuthApi,
} from '@backstage/core-plugin-api';

/**
 * Header name used to pass the user's IDP token to backend services.
 */
const OPENCHOREO_TOKEN_HEADER = 'x-openchoreo-token';

/**
 * Custom FetchApi implementation that automatically injects authentication tokens.
 *
 * This wrapper automatically adds:
 * - Backstage token in Authorization header (for Backstage backend auth)
 * - User's IDP token in x-openchoreo-token header (for OpenChoreo API auth)
 *
 * This eliminates the need to manually pass oauthApi to every API call.
 *
 * When openchoreo.features.auth.enabled is false (guest mode), the IDP token
 * injection is skipped to avoid triggering OAuth login prompts.
 */
export class OpenChoreoFetchApi implements FetchApi {
  private readonly authEnabled: boolean;

  constructor(
    private readonly identityApi: IdentityApi,
    private readonly oauthApi: OAuthApi,
    configApi: ConfigApi,
  ) {
    this.authEnabled =
      configApi.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;
  }

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const { token: backstageToken } = await this.identityApi.getCredentials();

    // Get IDP token for OpenChoreo only when auth is enabled
    // When auth is disabled (guest mode), skip to avoid triggering OAuth login prompts
    let idpToken: string | undefined;
    if (this.authEnabled) {
      try {
        idpToken = await this.oauthApi.getAccessToken();
      } catch {
        // Continue without IDP token if not available
      }
    }

    const headers = new Headers(init?.headers);
    if (backstageToken) {
      headers.set('Authorization', `Bearer ${backstageToken}`);
    }
    if (idpToken) {
      headers.set(OPENCHOREO_TOKEN_HEADER, idpToken);
    }

    return fetch(input, { ...init, headers });
  }
}
