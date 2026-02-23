import type { ObservabilityComponents } from '@openchoreo/openchoreo-client-node';
import type {
  EnvironmentResponse,
  ComponentResponse,
} from '@openchoreo/backstage-plugin-common';

export type Environment = EnvironmentResponse;
export type Component = ComponentResponse;
export type ResourceMetricsTimeSeries =
  ObservabilityComponents['schemas']['ResourceMetricsTimeSeries'];

export type ComponentMetricsTimeSeries =
  ObservabilityComponents['schemas']['ResourceMetricsTimeSeries'] &
    ObservabilityComponents['schemas']['HTTPMetricsTimeSeries'];
