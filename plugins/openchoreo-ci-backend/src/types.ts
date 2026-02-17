import type {
  ObservabilityComponents,
  OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';

// Import generated types from observability client
export type LogEntry = ObservabilityComponents['schemas']['LogEntry'];
export type RuntimeLogsResponse =
  ObservabilityComponents['schemas']['LogResponse'];

// Kubernetes events from the OpenChoreo API
export type ComponentWorkflowRunEventEntry =
  OpenChoreoLegacyComponents['schemas']['ComponentWorkflowRunEventEntry'];
