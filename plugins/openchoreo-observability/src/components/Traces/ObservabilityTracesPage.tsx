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
  useGetEnvironmentsByNamespace,
  useGetComponentsByProject,
} from '../../hooks';
import { useTraceSpans } from '../../hooks/useTraceSpans';
import { useSpanDetails } from '../../hooks/useSpanDetails';
import { Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import {
  useTracesPermission,
  ForbiddenState,
} from '@openchoreo/backstage-plugin-react';
import { calculateTimeRange } from './utils';

const ObservabilityTracesContent = () => {
  const { entity } = useEntity();
  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '';
  const projectName = entity.metadata.name as string;

  const {
    environments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useGetEnvironmentsByNamespace(namespace);
  const {
    components,
    loading: componentsLoading,
    error: componentsError,
  } = useGetComponentsByProject(entity);

  const { filters, updateFilters } = useUrlFilters({
    environments,
  });

  const {
    traces,
    total,
    loading: tracesLoading,
    error: tracesError,
    refresh,
  } = useTraces(filters, entity);

  // Determine which component name to pass for span queries
  // (mirrors what useTraces does — single selection passes the name)
  const selectedComponents = filters.components ?? [];
  const componentName =
    selectedComponents.length === 1 ? selectedComponents[0] : undefined;

  const { startTime, endTime } = filters.timeRange
    ? calculateTimeRange(filters.timeRange)
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

  if (environmentsError) {
    return <></>;
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
              ? 'Observability is not enabled for this project in this environment. Please enable observability to view traces'
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

          {tracesError && renderError(tracesError)}

          <TracesActions
            totalCount={total}
            disabled={tracesLoading}
            onRefresh={handleRefresh}
          />

          <TracesTable
            traces={traces}
            traceSpans={traceSpans}
            spanDetails={spanDetails}
            loading={tracesLoading}
          />
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
