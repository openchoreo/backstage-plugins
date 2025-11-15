import {
  ObservabilityComponents,
  OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Use generated types from OpenAPI spec
export type Environment = OpenChoreoComponents['schemas']['Environment'];
export type ResourceMetricsTimeSeries =
  ObservabilityComponents['schemas']['ResourceMetricsTimeSeries'];
