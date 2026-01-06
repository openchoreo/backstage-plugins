import { useEffect, useRef } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import { EmptyState, WarningIcon } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { LogsFilter } from './LogsFilter';
import { LogsTable } from './LogsTable';
import { LogsActions } from './LogsActions';
import { useEnvironments, useRuntimeLogs, useUrlFilters } from './hooks';
import {
  useInfiniteScroll,
  useLogsPermission,
} from '@openchoreo/backstage-plugin-react';
import { RuntimeLogsPagination } from './types';
import { useRuntimeLogsStyles } from './styles';

export const RuntimeLogs = () => {
  const classes = useRuntimeLogsStyles();
  const {
    canViewLogs,
    loading: permissionLoading,
    deniedTooltip,
  } = useLogsPermission();

  const {
    environments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useEnvironments();

  // URL-synced filters - must be after environments are available
  const { filters, updateFilters } = useUrlFilters({ environments });

  // Pagination config
  // (offset pagination is not supported by the backend, using timestamp-based pagination instead)
  const pagination: RuntimeLogsPagination = {
    hasMore: true,
    offset: 0,
    limit: 50,
  };

  const {
    logs,
    loading: logsLoading,
    error: logsError,
    totalCount,
    hasMore,
    fetchLogs,
    loadMore,
    refresh,
  } = useRuntimeLogs(filters, pagination, environments);

  const { loadingRef } = useInfiniteScroll(loadMore, hasMore, logsLoading);

  // Track previous backend-relevant filters to avoid unnecessary fetches
  const previousBackendFiltersRef = useRef({
    environmentId: filters.environmentId,
    logLevel: filters.logLevel,
    timeRange: filters.timeRange,
  });

  // Note: Auto-selection of first environment is handled by useUrlFilters hook

  // Fetch logs when backend-relevant filters change
  useEffect(() => {
    const currentBackendFilters = {
      environmentId: filters.environmentId,
      logLevel: filters.logLevel,
      timeRange: filters.timeRange,
      // TODO: Sort filter will be added here later
    };

    // Only fetch if backend-relevant filters changed
    const backendFiltersChanged =
      JSON.stringify(previousBackendFiltersRef.current) !==
      JSON.stringify(currentBackendFilters);

    if (filters.environmentId && backendFiltersChanged) {
      fetchLogs(true);
    }

    previousBackendFiltersRef.current = currentBackendFilters;
  }, [filters.environmentId, filters.logLevel, filters.timeRange, fetchLogs]);

  const handleRefresh = () => {
    refresh();
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
