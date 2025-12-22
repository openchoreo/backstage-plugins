/**
 * Factory functions for creating OpenChoreo API clients
 *
 * @packageDocumentation
 */

import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths as OpenChoreoPaths } from './generated/openchoreo/types';
import type { paths as ObservabilityPaths } from './generated/observability/types';
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
 * Creates an OpenChoreo API client
 *
 * @param config - Configuration options for the client
 * @returns Configured OpenChoreo API client instance
 *
 * @example
 * ```typescript
 * const client = createOpenChoreoApiClient({
 *   baseUrl: 'https://openchoreo.example.com',
 *   token: 'your-auth-token'
 * });
 *
 * const { data, error } = await client.GET('/orgs/{orgName}/projects', {
 *   params: { path: { orgName: 'my-org' } }
 * });
 * ```
 */
export function createOpenChoreoApiClient(config: OpenChoreoClientConfig) {
  const { baseUrl, token, fetchApi, logger } = config;

  logger?.debug(`Creating OpenChoreo API client with baseUrl: ${baseUrl}`);

  const clientOptions: ClientOptions = {
    baseUrl: baseUrl,
    fetch: fetchApi,
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  };

  const client = createClient<OpenChoreoPaths>(clientOptions);

  // Register tracing middleware if enabled via CHOREO_CLIENT_TRACE_ENABLED env var
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
 * const { data, error } = await client.POST('/api/logs/component/{componentId}', {
 *   params: { path: { componentId: 'my-component' } },
 *   body: {
 *     environmentId: 'dev',
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
          'Authorization': `Bearer ${token}`,
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
 * const { data: projects } = await client.GET('/orgs/{orgName}/projects', {
 *   params: { path: { orgName: 'my-org' } }
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

  return createOpenChoreoApiClient({
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
