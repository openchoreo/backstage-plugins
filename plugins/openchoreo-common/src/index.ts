export { CHOREO_ANNOTATIONS, CHOREO_LABELS, DEFAULT_PAGE_LIMIT } from './constants';
export {
  getRepositoryInfo,
  getRepositoryUrl,
  sanitizeLabel,
  filterEmptyObjectProperties,
} from './utils';
export type { RepositoryInfo } from './utils';
export {
  ComponentTypeUtils,
  type PageVariant,
  type ComponentTypeMapping,
} from './utils/componentTypeUtils';

// Feature flags types
export type { OpenChoreoFeatures, FeatureName } from './types/features';

// Re-export types from the generated OpenAPI client for use in frontend plugins
export type {
  OpenChoreoComponents,
  ObservabilityComponents,
} from '@openchoreo/openchoreo-client-node';

export { fetchAllResources, type PaginationResult } from './utils/pagination';

// Export commonly used type aliases for convenience
import type {
  OpenChoreoComponents,
  ObservabilityComponents,
} from '@openchoreo/openchoreo-client-node';

export type ModelsBuild = OpenChoreoComponents['schemas']['BuildResponse'];
export type ModelsWorkload =
  OpenChoreoComponents['schemas']['WorkloadResponse'];
export type ModelsCompleteComponent =
  OpenChoreoComponents['schemas']['ComponentResponse'];

// Workload-related types
export type Container = OpenChoreoComponents['schemas']['Container'];
export type EnvVar = OpenChoreoComponents['schemas']['EnvVar'];
export type FileVar = OpenChoreoComponents['schemas']['FileVar'];
export type WorkloadEndpoint =
  OpenChoreoComponents['schemas']['WorkloadEndpoint'];
export type Connection = OpenChoreoComponents['schemas']['Connection'];
export type WorkloadOwner = OpenChoreoComponents['schemas']['WorkloadOwner'];
export type ConnectionParams =
  OpenChoreoComponents['schemas']['ConnectionParams'];
export type ConnectionInject =
  OpenChoreoComponents['schemas']['ConnectionInject'];
export type Schema = OpenChoreoComponents['schemas']['Schema'];

// Define WorkloadType as a string union since it's defined as enum in OpenAPI
export type WorkloadType =
  | 'Service'
  | 'ManualTask'
  | 'ScheduledTask'
  | 'WebApplication';

// Observability types
export type RuntimeLogsResponse =
  ObservabilityComponents['schemas']['LogResponse'];
export type LogEntry = ObservabilityComponents['schemas']['LogEntry'];
