import { useEffect, useRef } from 'react';
import {
  Grid,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Button,
  Typography,
  Box,
} from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import { MetricsFilters } from './MetricsFilters';
import { MetricGraphByComponent } from './MetricGraphByComponent';
import { MetricsActions } from './MetricsActions';
import { HTTPMetricsSection } from './HTTPMetricsSection';
import {
  useGetNamespaceAndProjectByEntity,
  useGetEnvironmentsByNamespace,
  useUrlFilters,
  useMetrics,
} from '../../hooks';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  ResourceMetrics,
  CpuUsageMetrics,
  MemoryUsageMetrics,
} from '../../types';
import { useObservabilityMetricsPageStyles } from './styles';
import { Alert } from '@material-ui/lab';
import {
  useMetricsPermission,
  ForbiddenState,
} from '@openchoreo/backstage-plugin-react';

const ObservabilityMetricsContent = () => {
  const classes = useObservabilityMetricsPageStyles();
  const { entity } = useEntity();

  const {
    namespace,
    project,
    error: namespaceError,
  } = useGetNamespaceAndProjectByEntity(entity);
  const {
    environments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useGetEnvironmentsByNamespace(namespace, project);

  // URL-synced filters - must be after environments are available
  const { filters, updateFilters } = useUrlFilters({
    environments,
  });

  // Fetch metrics using the custom hook
  const {
    metrics,
    loading: metricsLoading,
    error: metricsError,
    fetchMetrics,
    refresh,
  } = useMetrics(filters, entity, namespace as string, project as string);
  const resourceMetrics = metrics as ResourceMetrics;

  // Track previous filter values to detect changes
  const previousFiltersRef = useRef({
    environment: filters.environment?.name,
    timeRange: filters.timeRange,
  });

  // Fetch metrics when filters change
  useEffect(() => {
    const currentFilters = {
      environment: filters.environment?.name,
      timeRange: filters.timeRange,
    };

    const filtersChanged =
      JSON.stringify(previousFiltersRef.current) !==
      JSON.stringify(currentFilters);

    if (filters.environment && filters.timeRange && filtersChanged) {
      fetchMetrics(true);
    }

    previousFiltersRef.current = currentFilters;
  }, [filters.environment, filters.timeRange, fetchMetrics]);

  const handleFiltersChange = (newFilters: Partial<typeof filters>) => {
    updateFilters(newFilters);
  };

  const handleRefresh = () => {
    refresh();
  };

  if (namespaceError) {
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
    <Box>
      {isLoading && <Progress />}

      {!isLoading && (
        <>
          <MetricsFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            environments={environments}
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
                    usageData={
                      resourceMetrics?.cpuUsage || ({} as CpuUsageMetrics)
                    }
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
                      resourceMetrics?.memoryUsage || ({} as MemoryUsageMetrics)
                    }
                    usageType="memory"
                    timeRange={filters.timeRange}
                  />
                </CardContent>
              </Card>
            </Grid>
            <HTTPMetricsSection
              filters={filters}
              entity={entity}
              namespaceName={namespace as string}
              project={project as string}
            />
          </Grid>
        </>
      )}
    </Box>
  );
};

export const ObservabilityMetricsPage = () => {
  const {
    canViewMetrics,
    loading: permissionLoading,
    deniedTooltip,
    permissionName,
  } = useMetricsPermission();

  if (permissionLoading) {
    return <Progress />;
  }

  if (!canViewMetrics) {
    return (
      <ForbiddenState
        message={deniedTooltip}
        permissionName={permissionName}
        variant="fullpage"
      />
    );
  }

  return <ObservabilityMetricsContent />;
};
