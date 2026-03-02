/**
 * Factory functions for creating OpenChoreo API clients
 *
 * @packageDocumentation
 */

import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths as OpenChoreoLegacyPaths } from './generated/openchoreo-legacy/types';
import type { paths as OpenChoreoPaths } from './generated/openchoreo/types';
import type { paths as ObservabilityPaths } from './generated/observability/types';
import type { paths as AIRCAAgentPaths } from './generated/ai-rca-agent/types';

/**
 * Header name used to route requests to new API handlers on the OpenChoreo backend.
 */
export const OPENCHOREO_API_VERSION_HEADER = 'X-Use-OpenAPI';
import { isTracingEnabled, createTracingMiddleware } from './tracing';

/**
 * Configuration options for OpenChoreo API clients
 */
export interface OpenChoreoClientConfig {
  /**
   * Base URL for the OpenChoreo API
   * @example 'https://openchoreo.example.com'
   */
  baseUrl: string;

  /**
   * Authentication token (Bearer token)
   * If not provided, requests will be made without authentication
   */
  token?: string;

  /**
   * Custom fetch implementation
   * Useful for testing or using a specific fetch polyfill
   */
  fetchApi?: typeof fetch;

  /**
   * Optional logger for debugging
   */
  logger?: LoggerService;
}

/**
 * Configuration options for OpenChoreo Observability API clients
 */
export interface OpenChoreoObservabilityClientConfig {
  /**
   * Base URL for the OpenChoreo Observability API
   * This URL is typically dynamically resolved from the main API
   * @example 'https://observability.openchoreo.example.com'
   */
  baseUrl: string;

  /**
   * Authentication token (passed as Authorization header)
   * If not provided, requests will be made without authentication
   */
  token?: string;

  /**
   * Custom fetch implementation
   * Useful for testing or using a specific fetch polyfill
   */
  fetchApi?: typeof fetch;

  /**
   * Optional logger for debugging
   */
  logger?: LoggerService;
}

/**
 * Configuration options for OpenChoreo AI RCA Agent API clients
 */
export interface OpenChoreoAIRCAAgentClientConfig {
  /**
   * Base URL for the OpenChoreo AI RCA Agent API
   * @example 'https://ai-rca-agent.openchoreo.example.com'
   */
  baseUrl: string;

  /**
   * Authentication token (passed as Authorization header)
   * If not provided, requests will be made without authentication
   */
  token?: string;

  /**
   * Custom fetch implementation
   * Useful for testing or using a specific fetch polyfill
   */
  fetchApi?: typeof fetch;

  /**
   * Optional logger for debugging
   */
  logger?: LoggerService;
}

/**
 * Creates an OpenChoreo Legacy API client (pre-1.0)
 *
 * @param config - Configuration options for the client
 * @returns Configured OpenChoreo Legacy API client instance
 *
 * @example
 * ```typescript
 * const client = createOpenChoreoLegacyApiClient({
 *   baseUrl: 'https://openchoreo.example.com',
 *   token: 'your-auth-token'
 * });
 *
 * const { data, error } = await client.GET('/namespaces/{namespaceName}/projects', {
 *   params: { path: { namespaceName: 'my-namespace' } }
 * });
 * ```
 */
export function createOpenChoreoLegacyApiClient(
  config: OpenChoreoClientConfig,
) {
  const { baseUrl, token, fetchApi, logger } = config;

  logger?.debug(
    `Creating OpenChoreo Legacy API client with baseUrl: ${baseUrl}`,
  );

  const clientOptions: ClientOptions = {
    baseUrl: baseUrl,
    fetch: fetchApi,
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  };

  const client = createClient<OpenChoreoLegacyPaths>(clientOptions);

  // Register tracing middleware if enabled via CHOREO_CLIENT_TRACE_ENABLED env var
  if (isTracingEnabled()) {
    client.use(createTracingMiddleware(logger));
    logger?.info('OpenChoreo Legacy API client tracing enabled');
  }

  return client;
}

/**
 * Creates an OpenChoreo API client (new 1.0 API)
 *
 * Uses K8s-style resource descriptors (metadata/spec/status) and dedicated
 * per-resource CRUD endpoints. Attaches the API version routing header.
 *
 * @param config - Configuration options for the client
 * @returns Configured OpenChoreo API client instance
 */
export function createOpenChoreoApiClient(config: OpenChoreoClientConfig) {
  const { baseUrl: rawBaseUrl, token, fetchApi, logger } = config;

  // Strip /api/v1 suffix since OpenAPI spec paths already include it
  const baseUrl = rawBaseUrl.replace(/\/api\/v1\/?$/, '');

  logger?.debug(`Creating OpenChoreo API client with baseUrl: ${baseUrl}`);

  const headers: Record<string, string> = {
    [OPENCHOREO_API_VERSION_HEADER]: 'true',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const clientOptions: ClientOptions = {
    baseUrl,
    fetch: fetchApi,
    headers,
  };

  const client = createClient<OpenChoreoPaths>(clientOptions);

  if (isTracingEnabled()) {
    client.use(createTracingMiddleware(logger));
    logger?.info('OpenChoreo API client tracing enabled');
  }

  return client;
}

/**
 * Creates an OpenChoreo Observability API client
 *
 * @param config - Configuration options for the client
 * @returns Configured Observability API client instance
 *
 * @example
 * ```typescript
 * const client = createOpenChoreoObservabilityApiClient({
 *   baseUrl: 'https://observability.openchoreo.example.com',
 *   token: 'your-auth-token'
 * });
 *
 * const { data, error } = await client.POST('/api/v1/logs/query', {
 *   body: {
 *     searchScope: { namespace: 'my-namespace', component: 'my-component' },
 *     limit: 100
 *   }
 * });
 * ```
 */
export function createOpenChoreoObservabilityApiClient(
  config: OpenChoreoObservabilityClientConfig,
) {
  const { baseUrl, token, fetchApi, logger } = config;

  logger?.debug(
    `Creating OpenChoreo Observability API client with baseUrl: ${baseUrl}`,
  );

  const clientOptions: ClientOptions = {
    baseUrl: baseUrl,
    fetch: fetchApi,
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  };

  const client = createClient<ObservabilityPaths>(clientOptions);

  // Register tracing middleware if enabled via CHOREO_CLIENT_TRACE_ENABLED env var
  if (isTracingEnabled()) {
    client.use(createTracingMiddleware(logger));
    logger?.info('OpenChoreo Observability API client tracing enabled');
  }

  return client;
}

/**
 * Creates an OpenChoreo AI RCA Agent API client
 *
 * @param config - Configuration options for the client
 * @returns Configured AI RCA Agent API client instance
 *
 * @example
 * ```typescript
 * const client = createOpenChoreoAIRCAAgentApiClient({
 *   baseUrl: 'https://ai-rca-agent.openchoreo.example.com',
 *   token: 'your-auth-token'
 * });
 *
 * const response = await client.POST('/chat', {
 *   body: {
 *     reportId: 'alert-789_1704067200',
 *     projectUid: '1c4e7a9b-3f6d-4e2a-8b5c-7d9f1e3a4c6b',
 *     environmentUid: '2f5a8c1e-7d9b-4e3f-6a4c-8e1f2d7a9b5c',
 *     messages: [{ role: 'user', content: 'What caused this issue?' }]
 *   }
 * });
 * ```
 */
export function createOpenChoreoAIRCAAgentApiClient(
  config: OpenChoreoAIRCAAgentClientConfig,
) {
  const { baseUrl, token, fetchApi, logger } = config;

  logger?.debug(
    `Creating OpenChoreo AI RCA Agent API client with baseUrl: ${baseUrl}`,
  );

  const clientOptions: ClientOptions = {
    baseUrl: baseUrl,
    fetch: fetchApi,
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  };

  const client = createClient<AIRCAAgentPaths>(clientOptions);

  // Register tracing middleware if enabled via CHOREO_CLIENT_TRACE_ENABLED env var
  if (isTracingEnabled()) {
    client.use(createTracingMiddleware(logger));
    logger?.info('OpenChoreo AI RCA Agent API client tracing enabled');
  }

  return client;
}

/**
 * Creates OpenChoreo API clients from Backstage configuration
 *
 * @param config - Backstage Config object
 * @param logger - Optional logger service
 * @returns Object containing the main API client
 *
 * @example
 * ```typescript
 * // In your Backstage backend module
 * const client = createOpenChoreoClientFromConfig(config, logger);
 * const { data: projects } = await client.GET('/namespaces/{namespaceName}/projects', {
 *   params: { path: { namespaceName: 'my-namespace' } }
 * });
 * ```
 *
 * @remarks
 * Expects the following configuration in app-config.yaml:
 * ```yaml
 * openchoreo:
 *   baseUrl: https://openchoreo.example.com
 *   token: ${OPENCHOREO_TOKEN}
 * ```
 */
export function createOpenChoreoClientFromConfig(
  config: Config,
  logger?: LoggerService,
) {
  const baseUrl = config.getString('openchoreo.baseUrl');
  const token = config.getOptionalString('openchoreo.token');

  logger?.info('Initializing OpenChoreo API client');

  return createOpenChoreoLegacyApiClient({
    baseUrl,
    token,
    logger,
  });
}

/**
 * Helper function to create an observability client with a dynamically resolved base URL
 *
 * @param observerBaseUrl - The dynamically resolved observer URL
 * @param token - Authentication token
 * @param logger - Optional logger service
 * @returns Configured Observability API client instance
 *
 * @example
 * ```typescript
 * // After resolving the observer URL from the main API
 * const observerUrl = 'https://observability.openchoreo.example.com';
 * const obsClient = createObservabilityClientWithUrl(observerUrl, token, logger);
 * ```
 */
export function createObservabilityClientWithUrl(
  observerBaseUrl: string,
  token?: string,
  logger?: LoggerService,
) {
  return createOpenChoreoObservabilityApiClient({
    baseUrl: observerBaseUrl,
    token,
    logger,
  });
}
