import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { EventsFilter } from './EventsFilter';
import { EventsTable } from './EventsTable';
import { EventsActions } from './EventsActions';
import {
  useRuntimeEvents,
  useGetNamespaceAndProjectByEntity,
  useUrlFiltersForRuntimeEvents,
} from '../../hooks';
import {
  useEventsPermission,
  ForbiddenState,
  useProjectEnvironments,
} from '@openchoreo/backstage-plugin-react';
import { EnvironmentsStatusNotice } from '../common';
import { useRuntimeEventsStyles } from './styles';

const ObservabilityRuntimeEventsContent = () => {
  const classes = useRuntimeEventsStyles();
  const { entity } = useEntity();

  // Get namespace and project names from entity
  const { namespace, project } = useGetNamespaceAndProjectByEntity(entity);

  // Fetch environments in deployment-pipeline order
  const {
    environments,
    loading: environmentsLoading,
    status: environmentsStatus,
  } = useProjectEnvironments(project, namespace);

  const { filters, updateFilters } = useUrlFiltersForRuntimeEvents({
    environments,
  });

  const selectedEnvironment = environments.find(
    env => env.name === filters.environment,
  );

  // Per-environment permission check: honors ABAC `resource.environment` CEL
  // constraints. Page-level gate below only verifies the user can view events
  // *somewhere* — this one gates the actual env content.
  const {
    canViewEvents: canViewEventsForEnv,
    loading: envPermissionLoading,
    deniedTooltip: envPermissionDenied,
    permissionName: envPermissionName,
  } = useEventsPermission(selectedEnvironment?.name);

  // Get component name from entity annotations
  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

  // Track last updated time
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const {
    events,
    loading: eventsLoading,
    error: eventsError,
    totalCount,
    hasMore,
    fetchEvents,
    loadMore,
    refresh,
  } = useRuntimeEvents(entity, namespace || '', project || '', {
    environment: filters.environment,
    timeRange: filters.timeRange,
    customStartTime: filters.customStartTime,
    customEndTime: filters.customEndTime,
    limit: 50,
    sortOrder: filters.sortOrder || 'asc',
    isLive: filters.isLive,
  });

  // Track previous filter values to detect changes.
  // Initialize with null to ensure initial fetch happens when ready.
  const previousFiltersRef = useRef<{
    environment: string;
    timeRange: string;
    customStartTime?: string;
    customEndTime?: string;
    sortOrder?: 'asc' | 'desc';
  } | null>(null);

  // Fetch events when filters change or when env/scope become available
  useEffect(() => {
    const currentFilters = {
      environment: filters.environment,
      timeRange: filters.timeRange,
      customStartTime: filters.customStartTime,
      customEndTime: filters.customEndTime,
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
      canViewEventsForEnv &&
      filtersChanged
    ) {
      fetchEvents(true);
      setLastUpdated(new Date());
      previousFiltersRef.current = currentFilters;
    }
  }, [
    filters.environment,
    filters.timeRange,
    filters.customStartTime,
    filters.customEndTime,
    filters.sortOrder,
    fetchEvents,
    selectedEnvironment,
    namespace,
    project,
    canViewEventsForEnv,
    envPermissionLoading,
  ]);

  // Update lastUpdated when events are refreshed
  useEffect(() => {
    if (!eventsLoading) {
      setLastUpdated(new Date());
    }
  }, [eventsLoading]);

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
            ? 'Observability is not enabled for this component in the current environment. Enable observability to view runtime events.'
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

  if (environmentsLoading) {
    return <Progress />;
  }

  if (environmentsStatus !== 'ok') {
    return (
      <Box>
        <EnvironmentsStatusNotice
          status={environmentsStatus}
          feature="events"
        />
      </Box>
    );
  }

  return (
    <Box>
      <EventsFilter
        filters={filters}
        onFiltersChange={handleFiltersChange}
        environments={environments}
        environmentsLoading={environmentsLoading}
        disabled={eventsLoading}
      />

      {eventsError && renderError(eventsError)}

      {filters.environment && !envPermissionLoading && !canViewEventsForEnv && (
        <ForbiddenState
          message={envPermissionDenied}
          permissionName={envPermissionName}
          variant="compact"
        />
      )}

      {filters.environment && canViewEventsForEnv && (
        <>
          <EventsActions
            totalCount={totalCount}
            disabled={eventsLoading || !filters.environment}
            onRefresh={handleRefresh}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            lastUpdated={lastUpdated}
          />

          <EventsTable
            selectedFields={filters.selectedFields}
            events={events}
            loading={eventsLoading}
            hasMore={hasMore}
            onLoadMore={loadMore}
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

export const ObservabilityRuntimeEventsPage = () => {
  const {
    canViewEvents,
    loading: permissionLoading,
    deniedTooltip,
    permissionName,
  } = useEventsPermission();

  if (permissionLoading) {
    return <Progress />;
  }

  if (!canViewEvents) {
    return (
      <ForbiddenState
        message={deniedTooltip}
        permissionName={permissionName}
        variant="fullpage"
      />
    );
  }

  return <ObservabilityRuntimeEventsContent />;
};
