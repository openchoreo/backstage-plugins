import { useCallback } from 'react';
import { Box, Button, Typography } from '@material-ui/core';
import { TracesFilters } from './TracesFilters';
import { TracesActions } from './TracesActions';
import { TracesTable } from './TracesTable';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  useUrlFilters,
  useTraces,
  useGetComponentsByProject,
} from '../../hooks';
import { useTraceSpans } from '../../hooks/useTraceSpans';
import { useSpanDetails } from '../../hooks/useSpanDetails';
import type { Filters } from '../../types';
import { Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import {
  useTracesPermission,
  ForbiddenState,
  calculateTimeRange,
  useProjectEnvironments,
} from '@openchoreo/backstage-plugin-react';
import { EnvironmentsStatusNotice } from '../common';

const ObservabilityTracesContent = () => {
  const { entity } = useEntity();
  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '';
  const projectName = entity.metadata.name as string;

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

  const { filters, updateFilters } = useUrlFilters({
    environments,
  });

  // Per-environment permission (ABAC `resource.environment`) — gates the
  // traces content once an environment is selected. See openchoreo#3408.
  const {
    canViewTraces: canViewTracesForEnv,
    loading: envPermissionLoading,
    deniedTooltip: envPermissionDenied,
    permissionName: envPermissionName,
  } = useTracesPermission(filters.environment?.name);

  // Don't fire the backend query until the per-env permission resolves to
  // allow — otherwise a denied user produces a 403 we'd have to suppress.
  // useTraces guards on filters.environment internally, so clearing it
  // turns the hook into a no-op while keeping the same hook-call order.
  const tracesFilters: Filters =
    canViewTracesForEnv && !envPermissionLoading
      ? filters
      : ({ ...filters, environment: undefined } as unknown as Filters);
  const {
    traces,
    total,
    loading: tracesLoading,
    error: tracesError,
    refresh,
  } = useTraces(tracesFilters, entity);

  // Determine which component name to pass for span queries
  // (mirrors what useTraces does — single selection passes the name)
  const selectedComponents = filters.components ?? [];
  const componentName =
    selectedComponents.length === 1 ? selectedComponents[0] : undefined;

  const { startTime, endTime } = filters.timeRange
    ? calculateTimeRange(filters.timeRange, {
        startTime: filters.customStartTime,
        endTime: filters.customEndTime,
      })
    : { startTime: undefined, endTime: undefined };

  const traceSpans = useTraceSpans({
    namespaceName: namespace,
    projectName,
    environmentName: filters.environment?.name ?? '',
    componentName,
    startTime,
    endTime,
  });

  const spanDetails = useSpanDetails({
    namespaceName: namespace,
    environmentName: filters.environment?.name ?? '',
  });

  const handleFiltersChange = useCallback(
    (newFilters: Partial<typeof filters>) => {
      updateFilters(newFilters);
    },
    [updateFilters],
  );

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  if (componentsError) {
    return <></>;
  }

  if (environmentsLoading) {
    return <Progress />;
  }

  if (environmentsStatus !== 'ok') {
    return (
      <Box>
        <EnvironmentsStatusNotice
          status={environmentsStatus}
          feature="traces"
        />
      </Box>
    );
  }

  const renderError = (error: string) => {
    const isObservabilityDisabled = error.includes(
      'Observability is not enabled',
    );

    return (
      <Box mt={2} mb={2}>
        <Alert severity={isObservabilityDisabled ? 'info' : 'error'}>
          <Typography variant="body1">
            {isObservabilityDisabled
              ? 'Observability is not enabled for this project in the current environment. Enable observability to view traces.'
              : error}
          </Typography>
          {!isObservabilityDisabled && (
            <Button onClick={handleRefresh} color="inherit" size="small">
              Retry
            </Button>
          )}
        </Alert>
      </Box>
    );
  };

  return (
    <Box>
      {tracesLoading && <Progress />}

      {!tracesLoading && (
        <>
          <TracesFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            environments={environments}
            environmentsLoading={environmentsLoading}
            components={components}
            componentsLoading={componentsLoading}
          />

          {filters.environment &&
            !envPermissionLoading &&
            !canViewTracesForEnv && (
              <ForbiddenState
                message={envPermissionDenied}
                permissionName={envPermissionName}
                variant="compact"
              />
            )}

          {(canViewTracesForEnv || envPermissionLoading) &&
            tracesError &&
            renderError(tracesError)}

          {(canViewTracesForEnv || envPermissionLoading) && (
            <TracesActions
              totalCount={total}
              disabled={tracesLoading}
              onRefresh={handleRefresh}
            />
          )}

          {(canViewTracesForEnv || envPermissionLoading) && (
            <TracesTable
              traces={traces}
              traceSpans={traceSpans}
              spanDetails={spanDetails}
              loading={tracesLoading || envPermissionLoading}
            />
          )}
        </>
      )}
    </Box>
  );
};

export const ObservabilityTracesPage = () => {
  const {
    canViewTraces,
    loading: permissionLoading,
    deniedTooltip,
    permissionName,
  } = useTracesPermission();

  if (permissionLoading) {
    return <Progress />;
  }

  if (!canViewTraces) {
    return (
      <ForbiddenState
        message={deniedTooltip}
        permissionName={permissionName}
        variant="fullpage"
      />
    );
  }

  return <ObservabilityTracesContent />;
};
