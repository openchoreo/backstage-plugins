import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { LogsFilter } from './LogsFilter';
import { LogsTable } from './LogsTable';
import { LogsActions } from './LogsActions';
import {
  useGetEnvironmentsByNamespace,
  useGetComponentsByProject,
  useProjectRuntimeLogs,
  useUrlFiltersForRuntimeLogs,
} from '../../hooks';
import {
  useInfiniteScroll,
  useLogsPermission,
  ForbiddenState,
} from '@openchoreo/backstage-plugin-react';
import { useRuntimeLogsStyles } from './styles';
import { Environment as RuntimeLogsEnvironment, LogEntryField } from './types';

const ObservabilityProjectRuntimeLogsContent = () => {
  const classes = useRuntimeLogsStyles();
  const { entity } = useEntity();

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';
  const projectName = entity.metadata.name || '';

  const {
    environments: observabilityEnvironments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useGetEnvironmentsByNamespace(namespace);

  const {
    components,
    loading: componentsLoading,
    error: componentsError,
  } = useGetComponentsByProject(entity);

  const environments = useMemo<RuntimeLogsEnvironment[]>(() => {
    return observabilityEnvironments.map(env => ({
      id: env.name,
      name: env.displayName || env.name,
      resourceName: env.name,
    }));
  }, [observabilityEnvironments]);

  const { filters, updateFilters } = useUrlFiltersForRuntimeLogs({
    environments,
  });

  const selectedEnvironment = environments.find(
    env => env.id === filters.environmentId,
  );
  const tableSelectedFields = useMemo(() => {
    const withoutComponent = filters.selectedFields.filter(
      field => field !== LogEntryField.ComponentName,
    );
    const logIndex = withoutComponent.indexOf(LogEntryField.Log);

    if (logIndex === -1) {
      return [...withoutComponent, LogEntryField.ComponentName];
    }

    return [
      ...withoutComponent.slice(0, logIndex),
      LogEntryField.ComponentName,
      ...withoutComponent.slice(logIndex),
    ];
  }, [filters.selectedFields]);

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
  } = useProjectRuntimeLogs(filters, entity, {
    environmentName: selectedEnvironment?.resourceName || '',
    namespaceName: namespace,
    projectName,
    limit: 50,
  });

  const { loadingRef } = useInfiniteScroll(loadMore, hasMore, logsLoading);

  const previousFiltersRef = useRef<{
    environmentId: string;
    logLevel: string[];
    timeRange: string;
    searchQuery?: string;
    sortOrder?: 'asc' | 'desc';
    componentIds: string[];
  } | null>(null);

  useEffect(() => {
    const currentFilters = {
      environmentId: filters.environmentId,
      logLevel: filters.logLevel,
      timeRange: filters.timeRange,
      searchQuery: filters.searchQuery,
      sortOrder: filters.sortOrder,
      componentIds: filters.componentIds || [],
    };

    const filtersChanged =
      previousFiltersRef.current === null ||
      JSON.stringify(previousFiltersRef.current) !==
        JSON.stringify(currentFilters);

    if (
      filters.environmentId &&
      selectedEnvironment &&
      namespace &&
      projectName &&
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
    filters.componentIds,
    fetchLogs,
    selectedEnvironment,
    namespace,
    projectName,
  ]);

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
            ? 'Observability is not enabled for this project in this environment. Please enable observability to view runtime logs.'
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

  if (componentsError) {
    return <Box>{renderError(componentsError)}</Box>;
  }

  return (
    <Box>
      <LogsFilter
        filters={filters}
        onFiltersChange={handleFiltersChange}
        environments={environments}
        environmentsLoading={environmentsLoading}
        components={components}
        componentsLoading={componentsLoading}
        disabled={logsLoading}
      />

      {logsError && renderError(logsError)}

      {!filters.environmentId &&
        !environmentsLoading &&
        environments.length === 0 && (
          <Alert severity="info" className={classes.errorContainer}>
            <Typography variant="body1">
              No environments found for this project.
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
            selectedFields={tableSelectedFields}
            logs={logs}
            loading={logsLoading}
            hasMore={hasMore}
            loadingRef={loadingRef}
            environmentName={selectedEnvironment?.name}
            projectName={projectName}
          />
        </>
      )}
    </Box>
  );
};

export const ObservabilityProjectRuntimeLogsPage = () => {
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
      <ForbiddenState message={deniedTooltip} permissionName={permissionName} />
    );
  }

  return <ObservabilityProjectRuntimeLogsContent />;
};
