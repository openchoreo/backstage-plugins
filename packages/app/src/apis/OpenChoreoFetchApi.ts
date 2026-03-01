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
 * Signal header for direct mode. When present, the fetch bypasses Backstage
 * backend auth and sends the IDP token directly in the Authorization header.
 * The header is stripped before the request is sent.
 */
const DIRECT_MODE_HEADER = 'x-openchoreo-direct';

/**
 * Custom FetchApi implementation that automatically injects authentication tokens.
 *
 * This wrapper supports two modes:
 *
 * **Normal mode** (default):
 * - Backstage token in Authorization header (for Backstage backend auth)
 * - User's IDP token in x-openchoreo-token header (for OpenChoreo API auth)
 *
 * **Direct mode** (when x-openchoreo-direct header is set):
 * - IDP token in Authorization header (for direct external API calls)
 * - No Backstage token (external APIs don't know about Backstage)
 * - The x-openchoreo-direct signal header is stripped before sending
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

    // Bind fetch method to preserve 'this' context when used as callback
    this.fetch = this.fetch.bind(this);
  }

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);

    // Check if this is a direct external API call (bypasses Backstage backend)
    const isDirect = headers.has(DIRECT_MODE_HEADER);
    if (isDirect) {
      headers.delete(DIRECT_MODE_HEADER);
    }

    if (isDirect) {
      // Direct mode: IDP token in Authorization header, no Backstage token
      if (this.authEnabled) {
        try {
          const idpToken = await this.oauthApi.getAccessToken();
          if (idpToken) {
            headers.set('Authorization', `Bearer ${idpToken}`);
          }
        } catch {
          // Continue without IDP token if not available
        }
      }
    } else {
      // Normal mode: Backstage token + IDP token in custom header
      const { token: backstageToken } = await this.identityApi.getCredentials();
      if (backstageToken) {
        headers.set('Authorization', `Bearer ${backstageToken}`);
      }

      if (this.authEnabled) {
        try {
          const idpToken = await this.oauthApi.getAccessToken();
          if (idpToken) {
            headers.set(OPENCHOREO_TOKEN_HEADER, idpToken);
          }
        } catch {
          // Continue without IDP token if not available
        }
      }
    }

    return fetch(input, { ...init, headers });
  }
}
