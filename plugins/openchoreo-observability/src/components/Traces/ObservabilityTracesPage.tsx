import { useMemo, useCallback } from 'react';
import { Box, Button, Typography } from '@material-ui/core';
import { TracesFilters } from './TracesFilters';
import { TracesActions } from './TracesActions';
import { TracesTable } from './TracesTable';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { convertToTableFormat } from './utils';
import {
  useUrlFilters,
  useTraces,
  useGetEnvironmentsByOrganization,
  useGetComponentsByProject,
} from '../../hooks';
import { Trace, Environment } from '../../types';
import { Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';

export const ObservabilityTracesPage = () => {
  const { entity } = useEntity();
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];
  const {
    environments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useGetEnvironmentsByOrganization(organization);
  const {
    components,
    loading: componentsLoading,
    error: componentsError,
  } = useGetComponentsByProject(entity);

  // URL-synced filters - must be after environments are available
  const { filters, updateFilters } = useUrlFilters({
    environments: environments as Environment[],
  });

  const {
    traces,
    loading: tracesLoading,
    error: tracesError,
    refresh,
  } = useTraces(filters, entity);

  // Note: Auto-selection of first environment is handled by useUrlFilters hook

  const handleFiltersChange = useCallback(
    (newFilters: Partial<typeof filters>) => {
      updateFilters(newFilters);
    },
    [updateFilters],
  );

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const tracesDataMap = useMemo(() => {
    const map = new Map<string, Trace>();
    traces.forEach(trace => {
      map.set(trace.traceId, trace);
    });
    return map;
  }, [traces]);

  const tableTraces = useMemo(() => {
    return convertToTableFormat(traces) as Trace[];
  }, [traces]);

  if (componentsError) {
    // TODO: Add a toast notification here
    return <></>;
  }

  if (environmentsError) {
    // TODO: Add a toast notification here
    return <></>;
  }

  const renderError = (error: string) => {
    const isObservabilityDisabled = error.includes(
      'Observability is not enabled',
    );

    return (
      <Alert
        severity={isObservabilityDisabled ? 'info' : 'error'}
        // className={classes.errorContainer}
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
            totalCount={traces.length}
            disabled={tracesLoading}
            onRefresh={handleRefresh}
          />

          <TracesTable
            traces={tableTraces}
            tracesDataMap={tracesDataMap}
            loading={tracesLoading}
          />
        </>
      )}
    </Box>
  );
};
