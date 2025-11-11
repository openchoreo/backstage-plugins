import { useEffect, useState, useRef } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { LogsFilter } from './LogsFilter';
import { LogsTable } from './LogsTable';
import { LogsActions } from './LogsActions';
import {
  useEnvironments,
  useRuntimeLogs,
  useInfiniteScroll,
  useFilters,
} from './hooks';
import { RuntimeLogsPagination } from './types';
import { useRuntimeLogsStyles } from './styles';

export const RuntimeLogs = () => {
  const classes = useRuntimeLogsStyles();
  const { filters, updateFilters } = useFilters();
  const {
    environments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useEnvironments();

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
  } = useRuntimeLogs(filters, pagination);

  const { loadingRef } = useInfiniteScroll(loadMore, hasMore, logsLoading);

  // Track previous backend-relevant filters to avoid unnecessary fetches
  const previousBackendFiltersRef = useRef({
    environmentId: filters.environmentId,
    logLevel: filters.logLevel,
    timeRange: filters.timeRange,
  });

  // Auto-refresh logs every 10 seconds when enabled
  const [autoRefresh, setAutoRefresh] = useState(false);
  const handleAutoRefreshToggle = () => {
    setAutoRefresh(prev => !prev);
  };
  useEffect(() => {
    if (autoRefresh && filters.environmentId && !logsLoading) {
      const intervalId = setInterval(() => {
        refresh();
      }, 10000); // 10 seconds
      return () => clearInterval(intervalId);
    }
    return undefined;
  }, [autoRefresh, filters.environmentId, logsLoading, refresh]);

  // Auto-select first environment when environments are loaded
  useEffect(() => {
    if (environments.length > 0 && !filters.environmentId) {
      updateFilters({ environmentId: environments[0].id });
    }
  }, [environments, filters.environmentId, updateFilters]);

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
            ? 'Observability is not enabled for this component. Please enable observability to view runtime logs.'
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
            autoRefresh={autoRefresh}
            disabled={logsLoading || !filters.environmentId}
            onRefresh={handleRefresh}
            onAutoRefreshToggle={handleAutoRefreshToggle}
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
