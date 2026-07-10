import { useEffect, useMemo, useRef, useState } from 'react';
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
  useGetComponentsByProject,
  useProjectRuntimeLogs,
  useUrlFiltersForRuntimeLogs,
} from '../../hooks';
import {
  useLogsPermission,
  ForbiddenState,
  useProjectEnvironments,
} from '@openchoreo/backstage-plugin-react';
import { EnvironmentsStatusNotice } from '../common';
import { RefreshOverlay } from '@openchoreo/backstage-design-system';
import { useRuntimeLogsStyles } from './styles';
import { LogEntryField } from './types';
import type { RenderLogRowAction } from './LogEntry';
import { logRowActionRendererApiRef } from '../../api/LogRowActionRendererApi';

export interface ObservabilityProjectRuntimeLogsPageProps {
  renderRowAction?: RenderLogRowAction;
}

const ObservabilityProjectRuntimeLogsContent = ({
  renderRowAction,
}: ObservabilityProjectRuntimeLogsPageProps) => {
  const classes = useRuntimeLogsStyles();
  const { entity } = useEntity();

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';
  const projectName = entity.metadata.name || '';

  const {
    environments,
    loading: environmentsLoading,
    status: environmentsStatus,
  } = useProjectEnvironments(projectName, namespace);

  const {
    components,
    loading: componentsLoading,
    error: componentsError,
  } = useGetComponentsByProject(entity);

  const { filters, updateFilters } = useUrlFiltersForRuntimeLogs({
    environments,
  });

  const selectedEnvironment = environments.find(
    env => env.name === filters.environment,
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
    isRefetching: logsRefetching,
    error: logsError,
    totalCount,
    hasMore,
    loadMore,
    refresh,
  } = useProjectRuntimeLogs(
    filters,
    entity,
    {
      environmentName: filters.environment,
      namespaceName: namespace,
      projectName,
      limit: 50,
    },
    // Fetch once an env is selected — the query keys on the filters (including
    // components + log levels) and refetches on its own when they change.
    Boolean(selectedEnvironment),
  );

  const previousFiltersRef = useRef<{
    environment: string;
    logLevel: string[];
    timeRange: string;
    customStartTime?: string;
    customEndTime?: string;
    searchQuery?: string;
    sortOrder?: 'asc' | 'desc';
    components: string[];
  } | null>(null);

  useEffect(() => {
    const currentFilters = {
      environment: filters.environment,
      logLevel: filters.logLevel,
      timeRange: filters.timeRange,
      customStartTime: filters.customStartTime,
      customEndTime: filters.customEndTime,
      searchQuery: filters.searchQuery,
      sortOrder: filters.sortOrder,
      components: filters.components || [],
    };

    const filtersChanged =
      previousFiltersRef.current === null ||
      JSON.stringify(previousFiltersRef.current) !==
        JSON.stringify(currentFilters);

    if (
      filters.environment &&
      selectedEnvironment &&
      namespace &&
      projectName &&
      filtersChanged
    ) {
      // The logs query keys on these filters and refetches on its own; this
      // effect only stamps "last updated" (and not when nothing will be shown).
      if (filters.logLevel.length > 0) {
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
    filters.components,
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
            ? 'Observability is not enabled for this project in the current environment. Enable observability to view runtime logs.'
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

  if (componentsError) {
    return <Box>{renderError(componentsError)}</Box>;
  }

  return (
    <Box position="relative">
      {/* Background revalidation indicator — suppressed in live mode, where the
          5s poll would otherwise flash it constantly and fight the Live toggle. */}
      <RefreshOverlay
        active={logsRefetching && !filters.isLive}
        label="Refreshing logs"
      />
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
            selectedFields={tableSelectedFields}
            logs={logs}
            loading={logsLoading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            environmentName={
              selectedEnvironment?.displayName || selectedEnvironment?.name
            }
            projectName={projectName}
            renderRowAction={renderRowAction}
          />
        </>
      )}
    </Box>
  );
};

export const ObservabilityProjectRuntimeLogsPage = ({
  renderRowAction,
}: ObservabilityProjectRuntimeLogsPageProps) => {
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
    <ObservabilityProjectRuntimeLogsContent
      renderRowAction={effectiveRenderRowAction}
    />
  );
};
