import { useEffect, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, Typography, Button } from '@material-ui/core';
import { RCAFilters } from './RCAFilters';
import { RCAActions } from './RCAActions';
import { RCATable } from './RCATable';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  useFilters,
  useGetEnvironmentsByOrganization,
  useRCAReports,
} from '../../hooks';
import { Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { RCAReport } from './RCAReport';

const RCAListView = () => {
  const { entity } = useEntity();
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];
  const {
    environments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useGetEnvironmentsByOrganization(organization);
  const { filters, updateFilters } = useFilters();

  const {
    reports,
    loading: reportsLoading,
    error: reportsError,
    refresh,
    totalCount,
  } = useRCAReports(filters, entity);

  // Auto-select first environment when environments are loaded
  useEffect(() => {
    if (environments.length > 0 && !filters.environment) {
      updateFilters({ environment: environments[0] });
    }
  }, [environments, filters.environment, updateFilters]);

  const handleFiltersChange = useCallback(
    (newFilters: Partial<typeof filters>) => {
      updateFilters(newFilters);
    },
    [updateFilters],
  );

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  if (environmentsError) {
    // TODO: Add a toast notification here
    return <></>;
  }

  const renderError = (error: string) => {
    const isObservabilityDisabled = error.includes(
      'Observability is not enabled',
    );
    const isRCAServiceDisabled = error.includes('RCA service not available');

    const isInfoAlert = isObservabilityDisabled || isRCAServiceDisabled;

    let errorMessage = error;
    if (isObservabilityDisabled) {
      errorMessage =
        'Observability is not enabled for this component. Please enable observability to view RCA reports.';
    } else if (isRCAServiceDisabled) {
      errorMessage =
        'AI-powered RCA is not enabled. Please enable it to view RCA reports.';
    }

    return (
      <Alert severity={isInfoAlert ? 'info' : 'error'}>
        <Typography variant="body1">{errorMessage}</Typography>
        {!isInfoAlert && (
          <Button onClick={handleRefresh} color="inherit" size="small">
            Retry
          </Button>
        )}
      </Alert>
    );
  };

  return (
    <Box>
      {reportsLoading && <Progress />}

      {!reportsLoading && (
        <>
          <RCAFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            environments={environments}
            environmentsLoading={environmentsLoading}
          />

          {reportsError && renderError(reportsError)}

          <RCAActions
            disabled={reportsLoading}
            onRefresh={handleRefresh}
            totalCount={totalCount}
          />

          <RCATable reports={reports} loading={reportsLoading} />
        </>
      )}
    </Box>
  );
};

export const RCAPage = () => {
  return (
    <Routes>
      <Route path="/" element={<RCAListView />} />
      <Route path="/:alertId" element={<RCAReport />} />
    </Routes>
  );
};
