import { useEffect, useRef, useMemo, useState } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import { EmptyState, Progress, WarningIcon } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { TriggersFilter } from './TriggersFilter';
import { TriggersTable } from './TriggersTable';
import { TriggersActions } from './TriggersActions';
import {
  useTriggers,
  useGetNamespaceAndProjectByEntity,
  useGetEnvironmentsByNamespace,
  useUrlFiltersForTriggers,
} from '../../hooks';
import { useLogsPermission } from '@openchoreo/backstage-plugin-react';
import { useRuntimeLogsStyles } from '../RuntimeLogs/styles';
import type { Environment as RuntimeLogsEnvironment } from '../RuntimeLogs/types';
import { TRIGGERS_PAGE_SIZE } from './types';

const ObservabilityTriggersContent = () => {
  const classes = useRuntimeLogsStyles();
  const { entity } = useEntity();

  const { namespace, project } = useGetNamespaceAndProjectByEntity(entity);

  const {
    environments: observabilityEnvironments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useGetEnvironmentsByNamespace(namespace);

  const environments = useMemo<RuntimeLogsEnvironment[]>(() => {
    return observabilityEnvironments.map(env => ({
      id: env.name,
      name: env.displayName || env.name,
      resourceName: env.name,
    }));
  }, [observabilityEnvironments]);

  const { filters, updateFilters } = useUrlFiltersForTriggers({
    environments,
  });

  const selectedEnvironment = environments.find(
    env => env.id === filters.environmentId,
  );

  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const {
    triggers,
    loading: triggersLoading,
    error: triggersError,
    totalCount,
    fetchTriggers,
    refresh,
  } = useTriggers(entity, namespace || '', project || '', {
    environmentId: filters.environmentId,
    environmentName: selectedEnvironment?.resourceName || '',
    timeRange: filters.timeRange,
    limit: TRIGGERS_PAGE_SIZE,
    offset: filters.page * TRIGGERS_PAGE_SIZE,
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
      fetchTriggers(true);
      setLastUpdated(new Date());
      previousFiltersRef.current = currentFilters;
    }
  }, [
    filters.environmentId,
    filters.timeRange,
    filters.sortOrder,
    filters.page,
    fetchTriggers,
    selectedEnvironment,
    namespace,
    project,
    componentName,
  ]);

  useEffect(() => {
    if (!triggersLoading) setLastUpdated(new Date());
  }, [triggersLoading]);

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
            ? 'Observability is not enabled for this component. Please enable observability to view triggers.'
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
      <TriggersFilter
        filters={filters}
        onFiltersChange={handleFiltersChange}
        environments={environments}
        environmentsLoading={environmentsLoading}
        disabled={triggersLoading}
      />

      {triggersError && renderError(triggersError)}

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

      {filters.environmentId && selectedEnvironment && (
        <>
          <TriggersActions
            totalCount={totalCount}
            disabled={triggersLoading || !filters.environmentId}
            onRefresh={handleRefresh}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            lastUpdated={lastUpdated}
          />

          <TriggersTable
            triggers={triggers}
            loading={triggersLoading}
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

export const ObservabilityTriggersPage = () => {
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

  return <ObservabilityTriggersContent />;
};
