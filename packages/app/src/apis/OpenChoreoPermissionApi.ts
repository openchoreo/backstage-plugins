import { Config } from '@backstage/config';
import {
  DiscoveryApi,
  IdentityApi,
  OAuthApi,
} from '@backstage/core-plugin-api';
import { AuthorizeResult } from '@backstage/plugin-permission-common';

/**
 * Header name used to pass the user's IDP token to backend services.
 */
const OPENCHOREO_TOKEN_HEADER = 'x-openchoreo-token';

/**
 * Custom PermissionApi implementation that injects the OpenChoreo IDP token.
 *
 * This is needed because Backstage's default PermissionClient uses cross-fetch
 * directly without allowing custom headers to be injected. By implementing
 * PermissionApi ourselves, we can ensure the x-openchoreo-token header is
 * included in permission authorization requests.
 *
 * This enables the backend permission policy to access the user's IDP token
 * for making authorization decisions via the OpenChoreo /authz/profile API.
 */
export class OpenChoreoPermissionApi {
  private readonly enabled: boolean;
  private readonly authEnabled: boolean;
  private readonly discovery: DiscoveryApi;
  private readonly identityApi: IdentityApi;
  private readonly oauthApi: OAuthApi;

  constructor(options: {
    config: Config;
    discovery: DiscoveryApi;
    identity: IdentityApi;
    oauthApi: OAuthApi;
  }) {
    this.discovery = options.discovery;
    this.identityApi = options.identity;
    this.oauthApi = options.oauthApi;
    this.enabled =
      options.config.getOptionalBoolean('permission.enabled') ?? false;
    this.authEnabled =
      options.config.getOptionalBoolean('openchoreo.features.auth.enabled') ??
      true;
  }

  async authorize(request: {
    permission: { name: string };
    resourceRef?: string;
  }) {
    // When permissions are disabled, allow everything
    if (!this.enabled) {
      return { result: AuthorizeResult.ALLOW };
    }

    const permissionApiUrl = await this.discovery.getBaseUrl('permission');
    const { token: backstageToken } = await this.identityApi.getCredentials();

    // Get IDP token only when auth is enabled
    // When auth is disabled (guest mode), skip to avoid triggering OAuth login prompts
    let idpToken: string | undefined;
    if (this.authEnabled) {
      try {
        idpToken = await this.oauthApi.getAccessToken();
      } catch {
        // Continue without IDP token if not available
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (backstageToken) {
      headers.Authorization = `Bearer ${backstageToken}`;
    }
    if (idpToken) {
      headers[OPENCHOREO_TOKEN_HEADER] = idpToken;
    }

    const response = await fetch(`${permissionApiUrl}/authorize`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: [{ id: crypto.randomUUID(), ...request }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Permission request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.items[0];
  }
}
