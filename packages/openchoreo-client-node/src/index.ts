/**
 * OpenChoreo API Client
 *
 * Auto-generated TypeScript API clients for OpenChoreo platform
 *
 * @packageDocumentation
 */

// Export logger interface
export type { Logger } from './logger';

// Export factory functions
export {
  createOpenChoreoApiClient,
  createOpenChoreoObservabilityApiClient,
  createOpenChoreoAIRCAAgentApiClient,
  createObservabilityClientWithUrl,
  type OpenChoreoClientConfig,
  type OpenChoreoObservabilityClientConfig,
  type OpenChoreoAIRCAAgentClientConfig,
} from './factory';

// Export Backstage-specific factory (requires @backstage/config peer dependency)
export { createOpenChoreoClientFromConfig } from './backstage';

// Export tracing utilities
export {
  isTracingEnabled,
  createTracingMiddleware,
  TRACE_ENV_VAR,
} from './tracing';

// Export generated types as namespaces
export * as OpenChoreoAPI from './generated/openchoreo';
export * as ObservabilityAPI from './generated/observability';
export * as AIRCAAgentAPI from './generated/ai-rca-agent';

// Re-export component types for convenience
export type { components as OpenChoreoComponents } from './generated/openchoreo/types';
export type { components as ObservabilityComponents } from './generated/observability/types';
export type { components as AIRCAAgentComponents } from './generated/ai-rca-agent/types';

// Export version
export { API_VERSION } from './version';

// Re-export openapi-fetch for convenience
export { default as createClient } from 'openapi-fetch';
export type { ClientOptions, FetchResponse, FetchOptions } from 'openapi-fetch';
