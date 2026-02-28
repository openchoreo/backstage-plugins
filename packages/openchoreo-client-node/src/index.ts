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
  createOpenChoreoLegacyApiClient,
  createOpenChoreoObservabilityApiClient,
  createOpenChoreoAIRCAAgentApiClient,
  createOpenChoreoClientFromConfig,
  createObservabilityClientWithUrl,
  OPENCHOREO_API_VERSION_HEADER,
  type OpenChoreoClientConfig,
  type OpenChoreoObservabilityClientConfig,
  type OpenChoreoAIRCAAgentClientConfig,
} from './factory';

// Export tracing utilities
export {
  isTracingEnabled,
  createTracingMiddleware,
  TRACE_ENV_VAR,
} from './tracing';

// Export observability URL resolver
export {
  ObservabilityUrlResolver,
  type ObservabilityUrlsResult,
  type ObservabilityUrlResolverOptions,
} from './observability-url-resolver';

// Export resource utilities (new API)
export {
  getName,
  getNamespace,
  getUid,
  getCreatedAt,
  getLabels,
  getAnnotations,
  getLabel,
  getAnnotation,
  getDisplayName,
  getDescription,
  getConditions,
  getCondition,
  getConditionStatus,
  isReady,
} from './resource-utils';

// Export pagination utilities (new API)
export { fetchAllPages } from './pagination-utils';

// Export generated types as namespaces
export * as OpenChoreoLegacyAPI from './generated/openchoreo-legacy';
export * as OpenChoreoAPI from './generated/openchoreo';
export * as ObservabilityAPI from './generated/observability';
export * as AIRCAAgentAPI from './generated/ai-rca-agent';

// Re-export component types for convenience
export type { components as OpenChoreoLegacyComponents } from './generated/openchoreo-legacy/types';
export type { components as OpenChoreoComponents } from './generated/openchoreo/types';
export type { components as ObservabilityComponents } from './generated/observability/types';
export type { components as AIRCAAgentComponents } from './generated/ai-rca-agent/types';

// Export version
export { API_VERSION } from './version';

// Re-export openapi-fetch for convenience
export { default as createClient } from 'openapi-fetch';
export type { ClientOptions, FetchResponse, FetchOptions } from 'openapi-fetch';
