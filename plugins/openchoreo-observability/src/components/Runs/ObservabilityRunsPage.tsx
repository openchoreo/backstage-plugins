import { useEffect, useRef, useMemo, useState } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import { EmptyState, Progress, WarningIcon } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { RunsFilter } from './RunsFilter';
import { RunsTable } from './RunsTable';
import { RunsActions } from './RunsActions';
import {
  useRuns,
  useGetNamespaceAndProjectByEntity,
  useUrlFiltersForRuns,
} from '../../hooks';
import {
  useLogsPermission,
  useProjectEnvironments,
} from '@openchoreo/backstage-plugin-react';
import { useRuntimeLogsStyles } from '../RuntimeLogs/styles';
import { EnvironmentsStatusNotice } from '../common';
import type { Environment } from './types';
import { RUNS_PAGE_SIZE } from './types';

const ObservabilityRunsContent = () => {
  const classes = useRuntimeLogsStyles();
  const { entity } = useEntity();

  const { namespace, project } = useGetNamespaceAndProjectByEntity(entity);

  const {
    environments: projectEnvironments,
    loading: environmentsLoading,
    status: environmentsStatus,
  } = useProjectEnvironments(project, namespace);

  // Map the upstream `{ name, displayName, ... }` environment shape onto the
  // simpler `{ id, name, resourceName }` shape the Runs filter / URL sync use.
  const environments = useMemo<Environment[]>(() => {
    return projectEnvironments.map(env => ({
      id: env.name,
      name: env.displayName || env.name,
      resourceName: env.name,
    }));
  }, [projectEnvironments]);

  const { filters, updateFilters } = useUrlFiltersForRuns({
    environments,
  });

  const selectedEnvironment = environments.find(
    env => env.id === filters.environmentId,
  );

  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const {
    runs,
    loading: runsLoading,
    error: runsError,
    totalCount,
    fetchRuns,
    refresh,
  } = useRuns(entity, namespace || '', project || '', {
    environmentId: filters.environmentId,
    environmentName: selectedEnvironment?.resourceName || '',
    timeRange: filters.timeRange,
    limit: RUNS_PAGE_SIZE,
    offset: filters.page * RUNS_PAGE_SIZE,
    sortOrder: filters.sortOrder,
  });

  const previousFiltersRef = useRef<{
    environmentId: string;
    timeRange: string;
    sortOrder: 'asc' | 'desc';
    page: number;
  } | null>(null);

  useEffect(() => {
    const currentFilters = {
      environmentId: filters.environmentId,
      timeRange: filters.timeRange,
      sortOrder: filters.sortOrder,
      page: filters.page,
    };
    const filtersChanged =
      previousFiltersRef.current === null ||
      JSON.stringify(previousFiltersRef.current) !==
        JSON.stringify(currentFilters);

    if (
      filters.environmentId &&
      selectedEnvironment &&
      namespace &&
      project &&
      componentName &&
      filtersChanged
    ) {
      fetchRuns(true);
      setLastUpdated(new Date());
      previousFiltersRef.current = currentFilters;
    }
  }, [
    filters.environmentId,
    filters.timeRange,
    filters.sortOrder,
    filters.page,
    fetchRuns,
    selectedEnvironment,
    namespace,
    project,
    componentName,
  ]);

  useEffect(() => {
    if (!runsLoading) setLastUpdated(new Date());
  }, [runsLoading]);

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
            ? 'Observability is not enabled for this component. Please enable observability to view runs.'
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

  // When the pipeline has no resolvable environments (empty, forbidden, or
  // unavailable) there's nothing to filter or list — show only the notice.
  if (environmentsStatus !== 'ok' && !environmentsLoading) {
    return (
      <Box>
        <EnvironmentsStatusNotice status={environmentsStatus} feature="runs" />
      </Box>
    );
  }

  return (
    <Box>
      <RunsFilter
        filters={filters}
        onFiltersChange={handleFiltersChange}
        environments={environments}
        environmentsLoading={environmentsLoading}
        disabled={runsLoading}
      />

      {runsError && renderError(runsError)}

      {filters.environmentId && selectedEnvironment && (
        <>
          <RunsActions
            totalCount={totalCount}
            disabled={runsLoading || !filters.environmentId}
            onRefresh={handleRefresh}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            lastUpdated={lastUpdated}
          />

          <RunsTable
            runs={runs}
            loading={runsLoading}
            namespaceName={namespace || ''}
            projectName={project || ''}
            environmentName={selectedEnvironment.resourceName}
            componentName={componentName || ''}
          />
        </>
      )}
    </Box>
  );
};

export const ObservabilityRunsPage = () => {
  const {
    canViewLogs,
    loading: permissionLoading,
    deniedTooltip,
  } = useLogsPermission();

  if (permissionLoading) return <Progress />;

  if (!canViewLogs) {
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

  return <ObservabilityRunsContent />;
};
