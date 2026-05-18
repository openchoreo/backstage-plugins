import { useCallback, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, Typography, Button } from '@material-ui/core';
import { RCAFilters } from '../RCA/RCAFilters';
import { RCAActions } from '../RCA/RCAActions';
import { CostAnalysisTable } from './CostAnalysisTable';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import type { FinOpsReportSummary } from '../../types';
import {
  useUrlFilters,
  useGetEnvironmentsByNamespace,
  useFinOpsReports,
} from '../../hooks';
import { Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import {
  useRcaPermission,
  ForbiddenState,
} from '@openchoreo/backstage-plugin-react';
import { CostAnalysisReport } from './CostAnalysisReport';
import { EntityLinkContext } from '../RCA/RCAReport/EntityLinkContext';

const CostAnalysisListContent = () => {
  const { entity } = useEntity();
  const namespace = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
  const projectName = entity.metadata.name;
  const namespaceValue = useMemo(
    () => ({ namespace: namespace || 'default' }),
    [namespace],
  );
  const {
    environments,
    loading: environmentsLoading,
    error: environmentsError,
  } = useGetEnvironmentsByNamespace(namespace, projectName);
  const { filters, updateFilters } = useUrlFilters({ environments });

  const {
    reports,
    loading: reportsLoading,
    error: reportsError,
    refresh,
  } = useFinOpsReports(filters, entity);

  const filteredReports = useMemo((): FinOpsReportSummary[] => {
    if (!filters.searchQuery) return reports;
    const q = filters.searchQuery.toLowerCase();
    return reports.filter(
      r =>
        (r.reportId || '').toLowerCase().includes(q) ||
        (r.component || '').toLowerCase().includes(q) ||
        (r.summary || '').toLowerCase().includes(q) ||
        (r.status || '').toLowerCase().includes(q),
    );
  }, [reports, filters.searchQuery]);

  const handleFiltersChange = useCallback(
    (newFilters: Partial<typeof filters>) => {
      updateFilters(newFilters);
    },
    [updateFilters],
  );

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const renderError = (error: string) => {
    const isObservabilityDisabled = error.includes(
      'Observability is not enabled',
    );
    const isFinOpsServiceDisabled = error.includes(
      'FinOps service is not configured',
    );
    const isInfoAlert = isObservabilityDisabled || isFinOpsServiceDisabled;

    let errorMessage = error;
    if (isObservabilityDisabled) {
      errorMessage =
        'Observability is not enabled for this environment. Enable observability and enable the FinOps agent.';
    } else if (isFinOpsServiceDisabled) {
      errorMessage =
        'FinOps Agent is not configured. Enable it to view cost analysis reports.';
    }

    return (
      <Box mt={2} mb={2}>
        <Alert severity={isInfoAlert ? 'info' : 'error'}>
          <Typography variant="body1">{errorMessage}</Typography>
          {!isInfoAlert && (
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
      {reportsLoading && <Progress />}

      {!reportsLoading && (
        <>
          <RCAFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            environments={environments}
            environmentsLoading={environmentsLoading}
          />

          {environmentsError && (
            <Box mt={2} mb={2}>
              <Alert severity="warning">
                <Typography variant="body1">
                  Failed to load environments. Environment filtering may not be
                  available.
                </Typography>
              </Alert>
            </Box>
          )}

          {reportsError && renderError(reportsError)}

          <RCAActions
            disabled={reportsLoading}
            onRefresh={handleRefresh}
            totalCount={filteredReports.length}
          />

          <EntityLinkContext.Provider value={namespaceValue}>
            <CostAnalysisTable
              reports={filteredReports}
              loading={reportsLoading}
            />
          </EntityLinkContext.Provider>
        </>
      )}
    </Box>
  );
};

const CostAnalysisListView = () => {
  const {
    canViewRca,
    loading: permissionLoading,
    deniedTooltip,
    permissionName,
  } = useRcaPermission();

  if (permissionLoading) {
    return <Progress />;
  }

  if (!canViewRca) {
    return (
      <ForbiddenState
        message={deniedTooltip}
        permissionName={permissionName}
        variant="fullpage"
      />
    );
  }

  return <CostAnalysisListContent />;
};

export const CostAnalysisPage = () => {
  return (
    <Routes>
      <Route path="/" element={<CostAnalysisListView />} />
      <Route path="/:reportId" element={<CostAnalysisReport />} />
    </Routes>
  );
};
