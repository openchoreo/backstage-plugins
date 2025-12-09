/**
 * OpenChoreo API Client
 *
 * Auto-generated TypeScript API clients for OpenChoreo platform
 *
 * @packageDocumentation
 */

// Export factory functions
export {
  createOpenChoreoApiClient,
  createOpenChoreoObservabilityApiClient,
  createOpenChoreoClientFromConfig,
  createObservabilityClientWithUrl,
  type OpenChoreoClientConfig,
  type OpenChoreoObservabilityClientConfig,
} from './factory';

// Export tracing utilities
export {
  isTracingEnabled,
  createTracingMiddleware,
  TRACE_ENV_VAR,
} from './tracing';

// Export generated types as namespaces
export * as OpenChoreoAPI from './generated/openchoreo';
export * as ObservabilityAPI from './generated/observability';

// Re-export component types for convenience
export type { components as OpenChoreoComponents } from './generated/openchoreo/types';
export type { components as ObservabilityComponents } from './generated/observability/types';

// Export version
export { API_VERSION } from './version';

// Re-export openapi-fetch for convenience
export { default as createClient } from 'openapi-fetch';
export type { ClientOptions, FetchResponse, FetchOptions } from 'openapi-fetch';
