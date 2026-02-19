import {
  ObservabilityComponents,
  OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';

// Use generated types from OpenAPI spec
export type Environment =
  OpenChoreoLegacyComponents['schemas']['EnvironmentResponse'];
export type Component =
  OpenChoreoLegacyComponents['schemas']['ComponentResponse'];
export type ResourceMetricsTimeSeries =
  ObservabilityComponents['schemas']['ResourceMetricsTimeSeries'];

export type ComponentMetricsTimeSeries =
  ObservabilityComponents['schemas']['ResourceMetricsTimeSeries'] &
    ObservabilityComponents['schemas']['HTTPMetricsTimeSeries'];
