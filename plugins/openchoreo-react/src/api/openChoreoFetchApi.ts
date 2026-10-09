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
 * Options for {@link OpenChoreoScopedFetchApi}.
 */
export interface OpenChoreoScopedFetchApiOptions {
  /** The host app's fetch API, which this one decorates. */
  baseFetchApi: FetchApi;
  /** Supplies the user's OpenChoreo token. */
  tokenApi: OpenChoreoTokenApi;
  /** Whether OpenChoreo authentication is enabled (`false` = guest mode). */
  authEnabled: boolean;
  /**
   * Absolute URL of the Backstage backend (config `backend.baseUrl`).
   *
   * In normal mode the IDP token is attached only to requests bound for this
   * origin, so a caller passing an unrelated URL cannot send the user's
   * credentials to a third party.
   */
  backendBaseUrl: string;
}

/**
 * Default {@link openChoreoFetchApiRef} implementation.
 *
 * Decorates a base `FetchApi` rather than replacing it, in two modes:
 *
 * - **Normal** — the base API authenticates the call to the Backstage backend;
 *   this wrapper adds the IDP token in `x-openchoreo-token` for the backend to
 *   forward to OpenChoreo. Attached only for `backendBaseUrl` destinations.
 * - **Direct** (request carries `x-openchoreo-direct`) — the call goes to an
 *   external OpenChoreo service that knows nothing about Backstage, so the IDP
 *   token goes in `Authorization` and credentials are included. The signal
 *   header is stripped before the request is sent. The destination is chosen
 *   by the caller, which opts in explicitly by setting the signal header.
 *
 * When OpenChoreo authentication is disabled (guest mode) no token is
 * requested, which keeps guest sessions from triggering a login prompt.
 */
export class OpenChoreoScopedFetchApi implements FetchApi {
  private readonly baseFetchApi: FetchApi;
  private readonly tokenApi: OpenChoreoTokenApi;
  private readonly authEnabled: boolean;
  private readonly backendBaseUrl: string;

  constructor(options: OpenChoreoScopedFetchApiOptions) {
    this.baseFetchApi = options.baseFetchApi;
    this.tokenApi = options.tokenApi;
    this.authEnabled = options.authEnabled;
    this.backendBaseUrl = options.backendBaseUrl;
    this.fetch = this.fetch.bind(this);
  }

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // A `Request` carries its own headers; starting from empty ones and then
    // passing them in `init` would drop them (and any direct-mode signal).
    const headers = new Headers(
      init?.headers ?? (isRequest(input) ? input.headers : undefined),
    );
    const isDirect = headers.has(OPENCHOREO_DIRECT_HEADER);
    if (isDirect) {
      headers.delete(OPENCHOREO_DIRECT_HEADER);
    }
    // Direct destinations are cross-origin services that authenticate with
    // cookies, so credentials ride along in guest mode too.
    const directInit: RequestInit = isDirect ? { credentials: 'include' } : {};

    if (!this.authEnabled) {
      return this.baseFetchApi.fetch(input, {
        ...init,
        ...directInit,
        headers,
      });
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
        ...directInit,
        headers,
      });
    }

    if (this.targetsBackend(input)) {
      try {
        const token = await this.tokenApi.getToken();
        if (token) {
          headers.set(OPENCHOREO_TOKEN_HEADER, token);
        }
      } catch {
        // Continue without the IDP token; the backend answers 401 and the
        // calling surface renders its own error state.
      }
    }

    return this.baseFetchApi.fetch(input, { ...init, headers });
  }

  /**
   * Whether the destination is the Backstage backend this app talks to.
   *
   * Every normal-mode OpenChoreo call resolves its URL through
   * `discoveryApi.getBaseUrl(...)`, so it always is; anything else is a
   * caller mistake and must not receive the token.
   */
  private targetsBackend(input: RequestInfo | URL): boolean {
    const raw = isRequest(input) ? input.url : String(input);
    try {
      const target = new URL(raw, this.backendBaseUrl);
      const backend = new URL(this.backendBaseUrl);
      return (
        target.origin === backend.origin &&
        target.pathname.startsWith(backend.pathname)
      );
    } catch {
      return false;
    }
  }
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== 'undefined' && input instanceof Request;
}
