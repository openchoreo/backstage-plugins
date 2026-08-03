import { useCallback, useMemo } from 'react';
import { PageLoader } from '@openchoreo/backstage-design-system';
import { Routes, Route } from 'react-router-dom';
import { Box, Typography, Button } from '@material-ui/core';
import { RCAFilters } from '../RCA/RCAFilters';
import { RCAActions } from '../RCA/RCAActions';
import { CostAnalysisTable } from './CostAnalysisTable';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import type { FinOpsReportSummary } from '../../types';
import { useUrlFilters, useFinOpsReports } from '../../hooks';

import { Alert } from '@material-ui/lab';
import {
  useRcaPermission,
  ForbiddenState,
  useProjectEnvironments,
} from '@openchoreo/backstage-plugin-react';
import { EnvironmentsStatusNotice } from '../common';
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
    status: environmentsStatus,
  } = useProjectEnvironments(projectName, namespace);
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

  // Wait for the environment resolution before rendering the filters, so the
  // filter bar doesn't flash before we know whether to show the notice.
  if (environmentsLoading) {
    return <PageLoader />;
  }

  // No resolvable environments (empty, forbidden, or unavailable) → show only
  // the notice, without the filters or reports.
  if (environmentsStatus !== 'ok') {
    return (
      <Box>
        <EnvironmentsStatusNotice
          status={environmentsStatus}
          feature="cost reports"
        />
      </Box>
    );
  }

  return (
    <Box>
      {reportsLoading && <PageLoader />}

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
    return <PageLoader />;
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
