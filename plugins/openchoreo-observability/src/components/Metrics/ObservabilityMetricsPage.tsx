import { useEffect, useRef } from 'react';
import {
  Grid,
  Card,
  CardContent,
  CardHeader,
  Divider,
} from '@material-ui/core';
import {
  Content,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { MetricsFilters } from './MetricsFilters';
import { MetricGraphByComponent } from './MetricGraphByComponent';
import { MetricsActions } from './MetricsActions';
import {
  useGetOrgAndProjectByEntity,
  useGetEnvironmentsByOrganization,
  useFilters,
  useMetrics,
} from '../../hooks';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CpuUsageMetrics, Environment, MemoryUsageMetrics } from '../../types';

export const ObservabilityMetricsPage = () => {
  const { entity } = useEntity();
  const { filters, updateFilters } = useFilters();
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

  // Fetch metrics using the custom hook
  const {
    metrics,
    loading: metricsLoading,
    error: metricsError,
    fetchMetrics,
    refresh,
  } = useMetrics(filters, entity, organization as string, project as string);

  // Track previous filter values to detect changes
  const previousFiltersRef = useRef({
    environmentId: filters.environmentId,
    timeRange: filters.timeRange,
  });

  // Auto-select first environment when environments are loaded
  useEffect(() => {
    if (environments.length > 0 && !filters.environmentId) {
      updateFilters({ environmentId: environments[0].name });
    }
  }, [environments, filters.environmentId, updateFilters]);

  // Fetch metrics when filters change
  useEffect(() => {
    const currentFilters = {
      environmentId: filters.environmentId,
      timeRange: filters.timeRange,
    };

    const filtersChanged =
      JSON.stringify(previousFiltersRef.current) !==
      JSON.stringify(currentFilters);

    if (filters.environmentId && filtersChanged) {
      fetchMetrics(true);
    }

    previousFiltersRef.current = currentFilters;
  }, [filters.environmentId, filters.timeRange, fetchMetrics]);

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

  return (
    <Content>
      {isLoading && <Progress />}
      {metricsError && <ResponseErrorPanel error={new Error(metricsError)} />}

      {!isLoading && (
        <>
          <MetricsFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            environments={environments as Environment[]}
            disabled={isLoading}
          />
          <MetricsActions onRefresh={handleRefresh} disabled={metricsLoading} />
          <Grid container spacing={4} style={{ marginTop: 16 }}>
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
          </Grid>
        </>
      )}
    </Content>
  );
};
