import { useEffect, useRef, useMemo, useState } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import { EmptyState, WarningIcon } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import { LogsFilter } from './LogsFilter';
import { LogsTable } from './LogsTable';
import { LogsActions } from './LogsActions';
import {
  useRuntimeLogs,
  useGetNamespaceAndProjectByEntity,
  useGetEnvironmentsByNamespace,
  useUrlFiltersForRuntimeLogs,
} from '../../hooks';
import {
  useInfiniteScroll,
  useLogsPermission,
} from '@openchoreo/backstage-plugin-react';
import { useRuntimeLogsStyles } from './styles';
import { Environment as RuntimeLogsEnvironment } from './types';

export const ObservabilityRuntimeLogsPage = () => {
  const classes = useRuntimeLogsStyles();
  const {
    canViewLogs,
    loading: permissionLoading,
    deniedTooltip,
  } = useLogsPermission();

  const { entity } = useEntity();

  // Get namespace and project names from entity
  const { namespace, project } = useGetNamespaceAndProjectByEntity(entity);

  // Fetch environments from observability backend
  const {
    environments: observabilityEnvironments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useGetEnvironmentsByNamespace(namespace);

  // Map observability Environment type to RuntimeLogs Environment type
  const environments = useMemo<RuntimeLogsEnvironment[]>(() => {
    return observabilityEnvironments.map(env => ({
      id: env.uid || env.name,
      name: env.displayName || env.name,
      resourceName: env.name, // Use name as resourceName for observability environments
    }));
  }, [observabilityEnvironments]);

  // URL-synced filters - must be after environments are available
  const { filters, updateFilters } = useUrlFiltersForRuntimeLogs({
    environments,
  });

  // Find the selected environment to get its name
  const selectedEnvironment = environments.find(
    env => env.id === filters.environmentId,
  );

  // Track last updated time
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const {
    logs,
    loading: logsLoading,
    error: logsError,
    totalCount,
    hasMore,
    fetchLogs,
    loadMore,
    refresh,
    componentId,
    projectId,
  } = useRuntimeLogs(entity, namespace || '', project || '', {
    environmentId: filters.environmentId,
    environmentName: selectedEnvironment?.resourceName || '',
    timeRange: filters.timeRange,
    logLevels: filters.logLevel,
    limit: 50,
    searchQuery: filters.searchQuery,
    sortOrder: filters.sortOrder || 'desc',
    isLive: filters.isLive,
  });

  const { loadingRef } = useInfiniteScroll(loadMore, hasMore, logsLoading);

  // Track previous filter values to detect changes
  // Initialize with null to ensure initial fetch happens when all conditions are ready
  const previousFiltersRef = useRef<{
    environmentId: string;
    logLevel: string[];
    timeRange: string;
    searchQuery?: string;
    sortOrder?: 'asc' | 'desc';
    componentId: string | null;
    projectId: string | null;
  } | null>(null);

  // Note: Auto-selection of first environment is handled by useUrlFilters hook

  // Fetch logs when filters change or when component/project IDs become available
  useEffect(() => {
    const currentFilters = {
      environmentId: filters.environmentId,
      logLevel: filters.logLevel,
      timeRange: filters.timeRange,
      searchQuery: filters.searchQuery,
      sortOrder: filters.sortOrder,
      componentId: componentId,
      projectId: projectId,
    };

    // Only fetch if filters changed (null means first load)
    const filtersChanged =
      previousFiltersRef.current === null ||
      JSON.stringify(previousFiltersRef.current) !==
        JSON.stringify(currentFilters);

    if (
      filters.environmentId &&
      selectedEnvironment &&
      namespace &&
      project &&
      componentId &&
      projectId &&
      filtersChanged
    ) {
      fetchLogs(true);
      setLastUpdated(new Date());
      previousFiltersRef.current = currentFilters;
    }
  }, [
    filters.environmentId,
    filters.logLevel,
    filters.timeRange,
    filters.searchQuery,
    filters.sortOrder,
    componentId,
    projectId,
    fetchLogs,
    selectedEnvironment,
    namespace,
    project,
  ]);

  // Update lastUpdated when logs are refreshed
  useEffect(() => {
    if (!logsLoading) {
      setLastUpdated(new Date());
    }
  }, [logsLoading]);

  const handleRefresh = () => {
    refresh();
    setLastUpdated(new Date());
  };

  const handleFiltersChange = (newFilters: Partial<typeof filters>) => {
    updateFilters(newFilters);
  };

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
            ? 'Observability is not enabled for this component in this environment. Please enable observability to view runtime logs.'
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

  if (environmentsError) {
    return <Box>{renderError(environmentsError)}</Box>;
  }

  // Show permission denied notification if user doesn't have access
  if (!permissionLoading && !canViewLogs) {
    return (
      <EmptyState
        missing="data"
        title="Permission Denied"
        description={
          <Box display="flex" alignItems="center" gridGap={8}>
            <WarningIcon />
            {deniedTooltip}
          </Box>
        }
      />
    );
  }

  return (
    <Box>
      <LogsFilter
        filters={filters}
        onFiltersChange={handleFiltersChange}
        environments={environments}
        environmentsLoading={environmentsLoading}
        disabled={logsLoading}
      />

      {logsError && renderError(logsError)}

      {!filters.environmentId &&
        !environmentsLoading &&
        environments.length === 0 && (
          <Alert severity="info" className={classes.errorContainer}>
            <Typography variant="body1">
              No environments found. Make sure your component is properly
              configured.
            </Typography>
          </Alert>
        )}

      {filters.environmentId && (
        <>
          <LogsActions
            totalCount={totalCount}
            disabled={logsLoading || !filters.environmentId}
            onRefresh={handleRefresh}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            lastUpdated={lastUpdated}
          />

          <LogsTable
            selectedFields={filters.selectedFields}
            logs={logs}
            loading={logsLoading}
            hasMore={hasMore}
            loadingRef={loadingRef}
          />
        </>
      )}
    </Box>
  );
};
