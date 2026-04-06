import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
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
  ForbiddenState,
} from '@openchoreo/backstage-plugin-react';
import { useRuntimeLogsStyles } from './styles';
import { LOG_LEVELS } from './types';

const ObservabilityRuntimeLogsContent = () => {
  const classes = useRuntimeLogsStyles();
  const { entity } = useEntity();

  // Get namespace and project names from entity
  const { namespace, project } = useGetNamespaceAndProjectByEntity(entity);

  // Fetch environments from observability backend
  const {
    environments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useGetEnvironmentsByNamespace(namespace);

  const { filters, updateFilters } = useUrlFiltersForRuntimeLogs({
    environments: environments,
  });

  const selectedEnvironment = environments.find(
    env => env.name === filters.environment,
  );

  // Get component name from entity annotations
  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

  // Track last updated time
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const allLogLevelsSelected = filters.logLevel.length === LOG_LEVELS.length;
  const noLogLevelSelected = filters.logLevel.length === 0;

  const {
    logs,
    loading: logsLoading,
    error: logsError,
    totalCount,
    hasMore,
    fetchLogs,
    loadMore,
    refresh,
    clearLogs,
  } = useRuntimeLogs(entity, namespace || '', project || '', {
    environment: filters.environment,
    timeRange: filters.timeRange,
    logLevels: allLogLevelsSelected ? undefined : filters.logLevel,
    limit: 50,
    searchQuery: filters.searchQuery,
    sortOrder: filters.sortOrder || 'asc',
    isLive: filters.isLive && !noLogLevelSelected,
  });

  const { loadingRef } = useInfiniteScroll(loadMore, hasMore, logsLoading);

  // Track previous filter values to detect changes
  // Initialize with null to ensure initial fetch happens when all conditions are ready
  const previousFiltersRef = useRef<{
    environment: string;
    logLevel: string[];
    timeRange: string;
    searchQuery?: string;
    sortOrder?: 'asc' | 'desc';
  } | null>(null);

  // Note: Auto-selection of first environment is handled by useUrlFilters hook

  // Fetch logs when filters change or when component/project IDs become available
  useEffect(() => {
    const currentFilters = {
      environment: filters.environment,
      logLevel: filters.logLevel,
      timeRange: filters.timeRange,
      searchQuery: filters.searchQuery,
      sortOrder: filters.sortOrder,
    };

    // Only fetch if filters changed (null means first load)
    const filtersChanged =
      previousFiltersRef.current === null ||
      JSON.stringify(previousFiltersRef.current) !==
        JSON.stringify(currentFilters);

    if (
      filters.environment &&
      selectedEnvironment &&
      namespace &&
      project &&
      filtersChanged
    ) {
      if (filters.logLevel.length === 0) {
        clearLogs();
      } else {
        fetchLogs(true);
        setLastUpdated(new Date());
      }
      previousFiltersRef.current = currentFilters;
    }
  }, [
    filters.environment,
    filters.logLevel,
    filters.timeRange,
    filters.searchQuery,
    filters.sortOrder,
    fetchLogs,
    clearLogs,
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
    if (noLogLevelSelected) {
      clearLogs();
      return;
    }
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

      {!filters.environment &&
        !environmentsLoading &&
        environments.length === 0 && (
          <Alert severity="info" className={classes.errorContainer}>
            <Typography variant="body1">
              No environments found. Make sure your component is properly
              configured.
            </Typography>
          </Alert>
        )}

      {filters.environment && (
        <>
          <LogsActions
            totalCount={totalCount}
            disabled={logsLoading || !filters.environment}
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
            environmentName={
              selectedEnvironment?.displayName || selectedEnvironment?.name
            }
            projectName={project}
            componentName={componentName}
          />
        </>
      )}
    </Box>
  );
};

export const ObservabilityRuntimeLogsPage = () => {
  const {
    canViewLogs,
    loading: permissionLoading,
    deniedTooltip,
    permissionName,
  } = useLogsPermission();

  if (permissionLoading) {
    return <Progress />;
  }

  if (!canViewLogs) {
    return (
      <ForbiddenState
        message={deniedTooltip}
        permissionName={permissionName}
        variant="fullpage"
      />
    );
  }

  return <ObservabilityRuntimeLogsContent />;
};
