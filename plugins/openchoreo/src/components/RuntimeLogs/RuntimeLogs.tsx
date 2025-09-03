import { useEffect, useState, useRef } from 'react';
import { Box, Typography, Button, Paper, Card, CardContent } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { makeStyles } from '@material-ui/core/styles';
import { LogsFilter } from './LogsFilter';
import { LogsTable } from './LogsTable';
import {
  useEnvironments,
  useRuntimeLogs,
  useInfiniteScroll,
  useFilters,
} from './hooks';
import { RuntimeLogsPagination } from './types';

const useStyles = makeStyles(theme => ({
  root: {
    padding: theme.spacing(0, 3),
    gap: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(3),
  },
  title: {
    fontWeight: 'bold',
  },

  errorContainer: {
    marginBottom: theme.spacing(2),
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
  },
  statsContainer: {
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
  },
  statItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(1),
  },
}));

export const RuntimeLogs = () => {
  const classes = useStyles();
  const { filters, updateFilters } = useFilters();
  const {
    environments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useEnvironments();

  const [pagination, setPagination] = useState<RuntimeLogsPagination>({
    hasMore: true,
    offset: 0,
    limit: 50,
  });

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

  // Track previous filters to avoid unnecessary fetches
  const previousFiltersRef = useRef(filters);

  // Auto-select first environment when environments are loaded
  useEffect(() => {
    if (environments.length > 0 && !filters.environmentId) {
      updateFilters({ environmentId: environments[0].id });
    }
  }, [environments, filters.environmentId, updateFilters]);

  // Fetch logs when filters change
  useEffect(() => {
    // Only fetch if the filter actually changed
    const filtersChanged =
      JSON.stringify(previousFiltersRef.current) !== JSON.stringify(filters);
    if (filters.environmentId && filtersChanged) {
      setPagination(prev => ({ ...prev, offset: 0 }));
      fetchLogs(true);
    }

    previousFiltersRef.current = filters;
  }, [filters, fetchLogs]);

  // Update pagination offset when loading more
  useEffect(() => {
    if (logs.length > 0) {
      setPagination(prev => ({ ...prev, offset: logs.length }));
    }
  }, [logs.length]);

  const handleRefresh = () => {
    setPagination(prev => ({ ...prev, offset: 0 }));
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
    return (
      <Box className={classes.root}>
        <Typography variant="h4" className={classes.title} gutterBottom>
          Runtime Logs
        </Typography>
        {renderError(environmentsError)}
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      <Card>
        <CardContent>
          <LogsFilter
            filters={filters}
            onFiltersChange={handleFiltersChange}
            environments={environments}
            environmentsLoading={environmentsLoading}
            disabled={logsLoading}
            onRefresh={handleRefresh}
            isRefreshing={logsLoading}
          />
        </CardContent>
      </Card>

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
          <LogsTable
            logs={logs}
            loading={logsLoading}
            hasMore={hasMore}
            totalCount={totalCount}
            loadingRef={loadingRef}
            onRetry={handleRefresh}
          />
        </>
      )}
    </Box>
  );
};
