import type { ObservabilityComponents } from '@openchoreo/openchoreo-client-node';
import type { ComponentWorkflowRunEventEntry } from '@openchoreo/backstage-plugin-common';

// Import generated types from observability client
export type LogEntry = ObservabilityComponents['schemas']['LogEntry'];
export type RuntimeLogsResponse =
  ObservabilityComponents['schemas']['LogResponse'];

// Kubernetes events from the OpenChoreo API
export type { ComponentWorkflowRunEventEntry };
