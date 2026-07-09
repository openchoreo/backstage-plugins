import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import { useApiHolder } from '@backstage/core-plugin-api';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { LogsFilter } from './LogsFilter';
import { LogsTable } from './LogsTable';
import { LogsActions } from './LogsActions';
import {
  useRuntimeLogs,
  useGetNamespaceAndProjectByEntity,
  useUrlFiltersForRuntimeLogs,
} from '../../hooks';
import {
  useLogsPermission,
  ForbiddenState,
  useProjectEnvironments,
} from '@openchoreo/backstage-plugin-react';
import { EnvironmentsStatusNotice } from '../common';
import { useRuntimeLogsStyles } from './styles';
import { LOG_LEVELS } from './types';
import type { RenderLogRowAction } from './LogEntry';
import { logRowActionRendererApiRef } from '../../api/LogRowActionRendererApi';

export interface ObservabilityRuntimeLogsPageProps {
  renderRowAction?: RenderLogRowAction;
}

const ObservabilityRuntimeLogsContent = ({
  renderRowAction,
}: ObservabilityRuntimeLogsPageProps) => {
  const classes = useRuntimeLogsStyles();
  const { entity } = useEntity();

  // Get namespace and project names from entity
  const { namespace, project } = useGetNamespaceAndProjectByEntity(entity);

  // Fetch environments in deployment-pipeline order
  const {
    environments,
    loading: environmentsLoading,
    status: environmentsStatus,
  } = useProjectEnvironments(project, namespace);

  const { filters, updateFilters } = useUrlFiltersForRuntimeLogs({
    environments,
  });

  const selectedEnvironment = environments.find(
    env => env.name === filters.environment,
  );

  // Per-environment permission check: honors ABAC `resource.environment` CEL
  // constraints (openchoreo#3408). Page-level gate below only verifies the
  // user can view logs *somewhere* — this one gates the actual env content.
  const {
    canViewLogs: canViewLogsForEnv,
    loading: envPermissionLoading,
    deniedTooltip: envPermissionDenied,
    permissionName: envPermissionName,
  } = useLogsPermission(selectedEnvironment?.name);

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
    customStartTime: filters.customStartTime,
    customEndTime: filters.customEndTime,
    logLevels: allLogLevelsSelected ? undefined : filters.logLevel,
    limit: 50,
    searchQuery: filters.searchQuery,
    sortOrder: filters.sortOrder || 'asc',
    isLive: filters.isLive && !noLogLevelSelected,
  });

  // Track previous filter values to detect changes
  // Initialize with null to ensure initial fetch happens when all conditions are ready
  const previousFiltersRef = useRef<{
    environment: string;
    logLevel: string[];
    timeRange: string;
    customStartTime?: string;
    customEndTime?: string;
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
      customStartTime: filters.customStartTime,
      customEndTime: filters.customEndTime,
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
      canViewLogsForEnv &&
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
    filters.customStartTime,
    filters.customEndTime,
    filters.searchQuery,
    filters.sortOrder,
    fetchLogs,
    clearLogs,
    selectedEnvironment,
    namespace,
    project,
    canViewLogsForEnv,
    envPermissionLoading,
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
            ? 'Observability is not enabled for this component in the current environment. Enable observability to view runtime logs.'
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
        <EnvironmentsStatusNotice status={environmentsStatus} feature="logs" />
      </Box>
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

      {filters.environment && !envPermissionLoading && !canViewLogsForEnv && (
        <ForbiddenState
          message={envPermissionDenied}
          permissionName={envPermissionName}
          variant="compact"
        />
      )}

      {filters.environment && canViewLogsForEnv && (
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
            onLoadMore={loadMore}
            environmentName={
              selectedEnvironment?.displayName || selectedEnvironment?.name
            }
            projectName={project}
            componentName={componentName}
            renderRowAction={renderRowAction}
          />
        </>
      )}
    </Box>
  );
};

export const ObservabilityRuntimeLogsPage = ({
  renderRowAction,
}: ObservabilityRuntimeLogsPageProps) => {
  const {
    canViewLogs,
    loading: permissionLoading,
    deniedTooltip,
    permissionName,
  } = useLogsPermission();

  // Prop wins for legacy callers; under NFS, fall back to the
  // host-registered renderer collected by the alpha plugin's
  // logRowActionRendererApi. useApiHolder + get returns undefined when
  // the API isn't registered, so legacy-only hosts stay no-op.
  const apiHolder = useApiHolder();
  const effectiveRenderRowAction: RenderLogRowAction | undefined =
    renderRowAction ?? apiHolder.get(logRowActionRendererApiRef)?.render;

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

  return (
    <ObservabilityRuntimeLogsContent
      renderRowAction={effectiveRenderRowAction}
    />
  );
};
