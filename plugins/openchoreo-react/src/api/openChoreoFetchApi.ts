import { createApiRef, type FetchApi } from '@backstage/core-plugin-api';
import {
  OPENCHOREO_DIRECT_HEADER,
  OPENCHOREO_TOKEN_HEADER,
} from '@openchoreo/backstage-plugin-common';
import type { OpenChoreoTokenApi } from './openChoreoTokenApiRef';

/**
 * A {@link @backstage/core-plugin-api#FetchApi} that additionally carries the
 * user's OpenChoreo IDP token.
 *
 * Use this — never the app-wide `fetchApiRef` — for every request bound for an
 * OpenChoreo backend plugin. It wraps the host's own fetch API, so the host
 * keeps its middleware (`plugin://` resolution, Backstage identity injection
 * scoped to its own backend, failure clarification) and the OpenChoreo token
 * is attached only to OpenChoreo-bound calls.
 */
export const openChoreoFetchApiRef = createApiRef<FetchApi>({
  id: 'openchoreo.fetch',
});

/**
 * Default {@link openChoreoFetchApiRef} implementation.
 *
 * Decorates a base `FetchApi` rather than replacing it, in two modes:
 *
 * - **Normal** — the base API authenticates the call to the Backstage backend;
 *   this wrapper adds the IDP token in `x-openchoreo-token` for the backend to
 *   forward to OpenChoreo.
 * - **Direct** (request carries `x-openchoreo-direct`) — the call goes to an
 *   external OpenChoreo service that knows nothing about Backstage, so the IDP
 *   token goes in `Authorization` and credentials are included. The signal
 *   header is stripped before the request is sent.
 *
 * When OpenChoreo authentication is disabled (guest mode) no token is
 * requested, which keeps guest sessions from triggering a login prompt.
 */
export class OpenChoreoScopedFetchApi implements FetchApi {
  constructor(
    private readonly baseFetchApi: FetchApi,
    private readonly tokenApi: OpenChoreoTokenApi,
    private readonly authEnabled: boolean,
  ) {
    this.fetch = this.fetch.bind(this);
  }

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    const isDirect = headers.has(OPENCHOREO_DIRECT_HEADER);
    if (isDirect) {
      headers.delete(OPENCHOREO_DIRECT_HEADER);
    }

    if (!this.authEnabled) {
      return this.baseFetchApi.fetch(input, { ...init, headers });
    }

    if (isDirect) {
      let token: string | undefined;
      try {
        token = await this.tokenApi.getToken();
      } catch (error) {
        throw new Error(
          `Failed to acquire an identity token for a direct API call: ${error}`,
          { cause: error },
        );
      }
      if (!token) {
        throw new Error(
          'Failed to acquire an identity token for a direct API call: token resolution returned an empty token',
        );
      }
      headers.set('Authorization', `Bearer ${token}`);
      return this.baseFetchApi.fetch(input, {
        ...init,
        headers,
        credentials: 'include',
      });
    }

    try {
      const token = await this.tokenApi.getToken();
      if (token) {
        headers.set(OPENCHOREO_TOKEN_HEADER, token);
      }
    } catch {
      // Continue without the IDP token; the backend answers 401 and the
      // calling surface renders its own error state.
    }

    return this.baseFetchApi.fetch(input, { ...init, headers });
  }
}
