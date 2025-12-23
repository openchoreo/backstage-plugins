import { useEffect, useRef } from 'react';
import {
  Grid,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Button,
  Typography,
} from '@material-ui/core';
import { Content, Progress } from '@backstage/core-components';
import { MetricsFilters } from './MetricsFilters';
import { MetricGraphByComponent } from './MetricGraphByComponent';
import { MetricsActions } from './MetricsActions';
import {
  useGetOrgAndProjectByEntity,
  useGetEnvironmentsByOrganization,
  useUrlFilters,
  useMetrics,
} from '../../hooks';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  CpuUsageMetrics,
  Environment,
  MemoryUsageMetrics,
  NetworkLatencyMetrics,
  NetworkThroughputMetrics,
} from '../../types';
import { useObservabilityMetricsPageStyles } from './styles';
import { Alert } from '@material-ui/lab';

export const ObservabilityMetricsPage = () => {
  const classes = useObservabilityMetricsPageStyles();
  const { entity } = useEntity();
  const {
    organization,
    project,
    error: organizationError,
  } = useGetOrgAndProjectByEntity(entity);
  const {
    environments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useGetEnvironmentsByOrganization(organization);

  // URL-synced filters - must be after environments are available
  const { filters, updateFilters } = useUrlFilters({
    environments: environments as Environment[],
  });

  // Fetch metrics using the custom hook
  const {
    metrics,
    loading: metricsLoading,
    error: metricsError,
    fetchMetrics,
    refresh,
    componentId,
    projectId,
  } = useMetrics(filters, entity, organization as string, project as string);

  // Track previous filter values to detect changes
  const previousFiltersRef = useRef({
    environmentId: filters.environment?.uid,
    timeRange: filters.timeRange,
    componentId: componentId,
    projectId: projectId,
  });

  // Note: Auto-selection of first environment is handled by useUrlFilters hook

  // Fetch metrics when filters change or when component/project IDs become available
  useEffect(() => {
    const currentFilters = {
      environmentId: filters.environment?.uid,
      timeRange: filters.timeRange,
      componentId: componentId,
      projectId: projectId,
    };

    const filtersChanged =
      JSON.stringify(previousFiltersRef.current) !==
      JSON.stringify(currentFilters);

    if (
      filters.environment &&
      filters.timeRange &&
      componentId &&
      projectId &&
      filtersChanged
    ) {
      fetchMetrics(true);
    }

    previousFiltersRef.current = currentFilters;
  }, [
    filters.environment,
    filters.timeRange,
    componentId,
    projectId,
    fetchMetrics,
  ]);

  const handleFiltersChange = (newFilters: Partial<typeof filters>) => {
    updateFilters(newFilters);
  };

  const handleRefresh = () => {
    refresh();
  };

  if (organizationError) {
    // TODO: Add a toast notification here
    return <></>;
  }

  if (environmentsError) {
    // TODO: Add a toast notification here
    return <></>;
  }

  const isLoading = environmentsLoading || metricsLoading;

  const renderError = (error: string) => {
    const isObservabilityDisabled = error.includes(
      'Observability is not enabled',
    );

    return (
      <Alert
        severity={isObservabilityDisabled ? 'info' : 'error'}
        className={classes.errorContainer}
      >
        <Typography variant="body1">
          {isObservabilityDisabled
            ? 'Observability is not enabled for this component in this environment. Please enable observability to view metrics.'
            : error}
        </Typography>
        {!isObservabilityDisabled && (
          <Button onClick={handleRefresh} color="inherit" size="small">
            Retry
          </Button>
        )}
      </Alert>
    );
  };

  return (
    <Content>
      {isLoading && <Progress />}

      {!isLoading && (
        <>
          <MetricsFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            environments={environments as Environment[]}
            disabled={isLoading}
          />
          {metricsError && renderError(metricsError)}
          <MetricsActions onRefresh={handleRefresh} disabled={metricsLoading} />
          <Grid container spacing={4} className={classes.metricsGridContainer}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="CPU Usage" />
                <Divider />
                <CardContent>
                  <MetricGraphByComponent
                    usageData={metrics?.cpuUsage || ({} as CpuUsageMetrics)}
                    usageType="cpu"
                    timeRange={filters.timeRange}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Memory Usage" />
                <Divider />
                <CardContent>
                  <MetricGraphByComponent
                    usageData={
                      metrics?.memoryUsage || ({} as MemoryUsageMetrics)
                    }
                    usageType="memory"
                    timeRange={filters.timeRange}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Network Throughput" />
                <Divider />
                <CardContent>
                  <MetricGraphByComponent
                    usageData={
                      metrics?.networkThroughput ||
                      ({} as NetworkThroughputMetrics)
                    }
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
                    usageData={
                      metrics?.networkLatency || ({} as NetworkLatencyMetrics)
                    }
                    usageType="networkLatency"
                    timeRange={filters.timeRange}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Content>
  );
};
