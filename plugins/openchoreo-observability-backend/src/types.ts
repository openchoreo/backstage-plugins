import type { ObservabilityComponents } from '@openchoreo/openchoreo-client-node';

export type ResourceMetricsTimeSeries =
  ObservabilityComponents['schemas']['ResourceMetricsTimeSeries'];

export type ComponentMetricsTimeSeries =
  ObservabilityComponents['schemas']['ResourceMetricsTimeSeries'] &
    ObservabilityComponents['schemas']['HttpMetricsTimeSeries'];
