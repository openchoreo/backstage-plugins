import { useEffect, useRef } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  Typography,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { MetricGraphByComponent } from './MetricGraphByComponent';
import {
  Filters,
  HttpMetrics,
  NetworkLatencyMetrics,
  NetworkThroughputMetrics,
} from '../../types';
import { Entity } from '@backstage/catalog-model';
import { useMetrics, useDataPlaneNetPolProvider } from '../../hooks';

type HTTPMetricsSectionProps = {
  filters: Filters;
  entity: Entity;
  namespaceName: string;
  project: string;
  refreshNonce: number;
};

export const HTTPMetricsSection = ({
  filters,
  entity,
  namespaceName,
  project,
  refreshNonce,
}: HTTPMetricsSectionProps) => {
  const { networkPolicyProvider, loading: netPolLoading } =
    useDataPlaneNetPolProvider(
      namespaceName,
      filters.environment?.dataPlaneRef,
    );
  const httpEnabled = networkPolicyProvider === 'cilium';
  const { metrics, error, fetchMetrics } = useMetrics(
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
  const previousRefreshNonceRef = useRef(refreshNonce);

  useEffect(() => {
    if (!httpEnabled) {
      return;
    }

    const currentFilters = {
      environment: filters.environment?.name,
      timeRange: filters.timeRange,
    };

    const filtersChanged =
      JSON.stringify(previousFiltersRef.current) !==
      JSON.stringify(currentFilters);
    const refreshRequested = previousRefreshNonceRef.current !== refreshNonce;

    if (
      filters.environment &&
      filters.timeRange &&
      (filtersChanged || refreshRequested)
    ) {
      fetchMetrics(true);
    }

    previousFiltersRef.current = currentFilters;
    previousRefreshNonceRef.current = refreshNonce;
  }, [
    httpEnabled,
    filters.environment,
    filters.timeRange,
    fetchMetrics,
    refreshNonce,
  ]);

  if (netPolLoading || !httpEnabled) {
    return null;
  }

  if (error) {
    const isMetricsModuleError = error.toLowerCase().includes('metrics module');

    return (
      <Grid item xs={12}>
        <Alert severity="error">
          <Typography variant="body1">
            {isMetricsModuleError
              ? 'HTTP metrics are unavailable. Check the metrics module configuration.'
              : 'Failed to load HTTP metrics.'}
          </Typography>
          <Typography variant="body2">{error}</Typography>
          {!isMetricsModuleError && (
            <Button
              onClick={() => fetchMetrics(true)}
              color="inherit"
              size="small"
            >
              Retry
            </Button>
          )}
        </Alert>
      </Grid>
    );
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
              customStartTime={filters.customStartTime}
              customEndTime={filters.customEndTime}
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
              customStartTime={filters.customStartTime}
              customEndTime={filters.customEndTime}
            />
          </CardContent>
        </Card>
      </Grid>
    </>
  );
};
