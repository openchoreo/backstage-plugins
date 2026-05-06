import { useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
} from '@material-ui/core';
import { MetricGraphByComponent } from './MetricGraphByComponent';
import {
  Filters,
  HttpMetrics,
  NetworkLatencyMetrics,
  NetworkThroughputMetrics,
} from '../../types';
import { useCiliumEnabled } from '@openchoreo/backstage-plugin-react';
import { Entity } from '@backstage/catalog-model';
import { useMetrics } from '../../hooks';

type HTTPMetricsSectionProps = {
  filters: Filters;
  entity: Entity;
  namespaceName: string;
  project: string;
};

export const HTTPMetricsSection = ({
  filters,
  entity,
  namespaceName,
  project,
}: HTTPMetricsSectionProps) => {
  const ciliumEnabled = useCiliumEnabled();
  const { metrics, loading, error, fetchMetrics } = useMetrics(
    filters,
    entity,
    namespaceName,
    project,
    'http',
  );
  const httpMetrics = metrics as HttpMetrics;

  const previousFiltersRef = useRef({
    environment: undefined as string | undefined,
    timeRange: undefined as string | undefined,
  });

  useEffect(() => {
    if (!ciliumEnabled || loading) {
      return;
    }

    const currentFilters = {
      environment: filters.environment?.name,
      timeRange: filters.timeRange,
    };

    const filtersChanged =
      JSON.stringify(previousFiltersRef.current) !==
      JSON.stringify(currentFilters);

    if (
      filters.environment &&
      filters.timeRange &&
      (filtersChanged || !metrics)
    ) {
      fetchMetrics(true);
    }

    previousFiltersRef.current = currentFilters;
  }, [
    ciliumEnabled,
    loading,
    filters.environment,
    filters.timeRange,
    metrics,
    fetchMetrics,
  ]);

  if (!ciliumEnabled || error) {
    return null;
  }

  const throughputData =
    httpMetrics?.networkThroughput || ({} as NetworkThroughputMetrics);
  const latencyData =
    httpMetrics?.networkLatency || ({} as NetworkLatencyMetrics);

  return (
    <>
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Network Throughput" />
          <Divider />
          <CardContent>
            <MetricGraphByComponent
              usageData={throughputData}
              usageType="networkThroughput"
              timeRange={filters.timeRange}
            />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Network Latency" />
          <Divider />
          <CardContent>
            <MetricGraphByComponent
              usageData={latencyData}
              usageType="networkLatency"
              timeRange={filters.timeRange}
            />
          </CardContent>
        </Card>
      </Grid>
    </>
  );
};
