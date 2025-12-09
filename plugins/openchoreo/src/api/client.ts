import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

export interface ApiFetchOptions {
  /** API endpoint path (e.g., '/deploy', '/promote-deployment') */
  endpoint: string;
  /** Backstage discovery API */
  discovery: DiscoveryApi;
  /** Backstage identity API */
  identity: IdentityApi;
  /** HTTP method (defaults to 'GET') */
  method?: HttpMethod;
  /** Request body for POST/PATCH/DELETE */
  body?: unknown;
  /** URL query parameters */
  params?: Record<string, string>;
}

/**
 * Centralized fetch utility for OpenChoreo API calls.
 * Handles authentication, URL construction, and error handling consistently.
 *
 * Note: The user's IDP token is automatically injected by the custom FetchApi
 * configured in packages/app/src/apis.ts (OpenChoreoFetchApi).
 *
 * @example
 * // GET request with params
 * const data = await apiFetch({
 *   endpoint: API_ENDPOINTS.ENVIRONMENT_INFO,
 *   discovery,
 *   identity,
 *   params: { componentName, projectName, organizationName },
 * });
 *
 * @example
 * // POST request with body
 * const result = await apiFetch({
 *   endpoint: API_ENDPOINTS.PROMOTE_DEPLOYMENT,
 *   discovery,
 *   identity,
 *   method: 'POST',
 *   body: { sourceEnv, targetEnv, componentName, projectName, orgName },
 * });
 */
export async function apiFetch<T = unknown>({
  endpoint,
  discovery,
  identity,
  method = 'GET',
  body,
  params,
}: ApiFetchOptions): Promise<T> {
  const { token } = await identity.getCredentials();
  const baseUrl = await discovery.getBaseUrl('openchoreo');
  const url = new URL(`${baseUrl}${endpoint}`);

  if (params) {
    url.search = new URLSearchParams(params).toString();
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch without throwing on non-OK responses.
 * Returns the response for custom handling.
 *
 * Note: The user's IDP token is automatically injected by the custom FetchApi
 * configured in packages/app/src/apis.ts (OpenChoreoFetchApi).
 */
export async function apiFetchRaw({
  endpoint,
  discovery,
  identity,
  method = 'GET',
  body,
  params,
}: ApiFetchOptions): Promise<Response> {
  const { token } = await identity.getCredentials();
  const baseUrl = await discovery.getBaseUrl('openchoreo');
  const url = new URL(`${baseUrl}${endpoint}`);

  if (params) {
    url.search = new URLSearchParams(params).toString();
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
