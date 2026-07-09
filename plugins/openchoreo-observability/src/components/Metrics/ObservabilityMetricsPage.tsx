import { useEffect, useState } from 'react';
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
  useUrlFilters,
  useMetrics,
} from '../../hooks';
import { useProjectEnvironments } from '@openchoreo/backstage-plugin-react';
import { EnvironmentsStatusNotice } from '../common';
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
    status: environmentsStatus,
  } = useProjectEnvironments(project, namespace);

  // URL-synced filters - must be after environments are available
  const { filters, updateFilters } = useUrlFilters({
    environments,
  });

  // Per-environment permission (ABAC `resource.environment`) — gates the
  // metrics content and the fetch once an env is selected. See openchoreo#3408.
  const {
    canViewMetrics: canViewMetricsForEnv,
    loading: envPermissionLoading,
    deniedTooltip: envPermissionDenied,
    permissionName: envPermissionName,
  } = useMetricsPermission(filters.environment?.name);

  // Fetch metrics using the custom hook
  const {
    metrics,
    loading: metricsLoading,
    error: metricsError,
    fetchMetrics,
    refresh,
  } = useMetrics(filters, entity, namespace as string, project as string);
  const resourceMetrics = metrics as ResourceMetrics;

  // Fetch metrics when filters change
  useEffect(() => {
    if (filters.environment && filters.timeRange && canViewMetricsForEnv) {
      fetchMetrics(true);
    }
  }, [
    filters.environment,
    filters.timeRange,
    fetchMetrics,
    canViewMetricsForEnv,
  ]);

  const [refreshNonce, setRefreshNonce] = useState(0);

  const handleFiltersChange = (newFilters: Partial<typeof filters>) => {
    updateFilters(newFilters);
  };

  const handleRefresh = () => {
    refresh();
    setRefreshNonce(prev => prev + 1);
  };

  if (namespaceError) {
    // TODO: Add a toast notification here
    return <></>;
  }

  // When the pipeline has no resolvable environments (empty, forbidden, or
  // unavailable) there's nothing to filter or chart — show only the notice.
  if (environmentsStatus !== 'ok') {
    return (
      <Box>
        <EnvironmentsStatusNotice
          status={environmentsStatus}
          feature="metrics"
        />
      </Box>
    );
  }

  const isLoading = environmentsLoading;

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
            ? 'Observability is not enabled for this component in the current environment. Enable observability to view metrics.'
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
      {(isLoading || metricsLoading) && <Progress />}

      {!isLoading && (
        <>
          <MetricsFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            environments={environments}
            disabled={isLoading}
          />
          {filters.environment &&
            !envPermissionLoading &&
            !canViewMetricsForEnv && (
              <ForbiddenState
                message={envPermissionDenied}
                permissionName={envPermissionName}
                variant="compact"
              />
            )}
          {canViewMetricsForEnv && metricsError && renderError(metricsError)}
          {canViewMetricsForEnv && (
            <MetricsActions
              onRefresh={handleRefresh}
              disabled={metricsLoading}
            />
          )}
          {canViewMetricsForEnv && (
            <Grid
              container
              spacing={4}
              className={classes.metricsGridContainer}
            >
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
                      customStartTime={filters.customStartTime}
                      customEndTime={filters.customEndTime}
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
                        resourceMetrics?.memoryUsage ||
                        ({} as MemoryUsageMetrics)
                      }
                      usageType="memory"
                      timeRange={filters.timeRange}
                      customStartTime={filters.customStartTime}
                      customEndTime={filters.customEndTime}
                    />
                  </CardContent>
                </Card>
              </Grid>
              <HTTPMetricsSection
                filters={filters}
                entity={entity}
                namespaceName={namespace as string}
                project={project as string}
                refreshNonce={refreshNonce}
              />
            </Grid>
          )}
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
