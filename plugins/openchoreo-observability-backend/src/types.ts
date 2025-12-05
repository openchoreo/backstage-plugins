import {
  ObservabilityComponents,
  OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Use generated types from OpenAPI spec
export type Environment =
  OpenChoreoComponents['schemas']['EnvironmentResponse'];
export type Component = OpenChoreoComponents['schemas']['ComponentResponse'];
export type ResourceMetricsTimeSeries =
  ObservabilityComponents['schemas']['ResourceMetricsTimeSeries'];

export type ComponentMetricsTimeSeries =
  ObservabilityComponents['schemas']['ResourceMetricsTimeSeries'] &
    ObservabilityComponents['schemas']['HTTPMetricsTimeSeries'];
