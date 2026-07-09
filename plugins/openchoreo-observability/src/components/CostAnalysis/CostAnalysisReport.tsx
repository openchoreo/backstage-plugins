import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography } from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import {
  useRcaPermission,
  ForbiddenState,
  useProjectEnvironments,
} from '@openchoreo/backstage-plugin-react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { RefreshOverlay } from '@openchoreo/backstage-design-system';
import { useFinOpsReport, useFilters } from '../../hooks';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { CostAnalysisReportView } from './CostAnalysisReportView';
import { useApi, discoveryApiRef } from '@backstage/core-plugin-api';
import { finopsAgentApiRef } from '../../api/FinOpsAgentApi';

const CostAnalysisReportContent = () => {
  const { reportId } = useParams<{ reportId?: string }>();
  const navigate = useNavigate();
  const { entity } = useEntity();
  const { filters } = useFilters();
  const namespace = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
  const projectName = entity.metadata.name as string;
  const finopsAgentApi = useApi(finopsAgentApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  // Get environments to ensure we have environment data
  const { environments } = useProjectEnvironments(projectName, namespace);
  const environment = filters.environment || environments[0];

  const {
    report: detailedReport,
    loading,
    isRefetching,
    error,
    refresh,
  } = useFinOpsReport(reportId, environment?.name, entity);

  const [backendBaseUrl, setBackendBaseUrl] = useState<string | undefined>();
  const [discoveryError, setDiscoveryError] = useState<string | undefined>();
  useEffect(() => {
    discoveryApi
      .getBaseUrl('openchoreo-observability-backend')
      .then(setBackendBaseUrl)
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error(
          'Failed to discover openchoreo-observability-backend:',
          err,
        );
        setDiscoveryError(
          err instanceof Error
            ? err.message
            : 'Failed to connect to the observability backend.',
        );
      });
  }, [discoveryApi]);

  if (loading) {
    return <Progress />;
  }

  if (error) {
    let errorMessage = error;
    let severity: 'info' | 'error' = 'error';

    if (error.includes('FinOps service is not configured')) {
      errorMessage =
        'FinOps Agent is not configured. Enable it to view cost analysis reports.';
      severity = 'info';
    } else if (error.includes('Observability is not enabled')) {
      errorMessage =
        'Observability is not enabled for this environment. Enable observability and enable the FinOps agent.';
      severity = 'info';
    }

    return (
      <Box mt={2} mb={2}>
        <Alert severity={severity}>
          <Typography variant="body1">{errorMessage}</Typography>
        </Alert>
      </Box>
    );
  }

  if (discoveryError) {
    return (
      <Box mt={2} mb={2}>
        <Alert severity="error">
          <Typography variant="body1">{discoveryError}</Typography>
        </Alert>
      </Box>
    );
  }

  if (!detailedReport) {
    if (!reportId) {
      return (
        <Alert severity="error">
          <Typography variant="body1">Report ID is required</Typography>
        </Alert>
      );
    }
    return null;
  }

  const handleBack = () => {
    navigate(-1);
  };

  const componentName = detailedReport.report?.component;
  const catalogNs = entity.metadata.namespace || 'default';
  const environmentName = environment?.name || detailedReport.environment;
  const componentUrl = componentName
    ? `/catalog/${catalogNs}/component/${componentName}`
    : undefined;
  const metricsUrl = componentName
    ? `/catalog/${catalogNs}/component/${componentName}/metrics${
        environmentName ? `?env=${environmentName}` : ''
      }`
    : undefined;

  const chatContext = {
    backendBaseUrl,
    namespaceName: namespace || '',
    environmentName: environmentName || '',
    finopsAgentApi,
  };

  return (
    <Box position="relative">
      <RefreshOverlay active={isRefetching} label="Refreshing cost report" />
      <CostAnalysisReportView
        report={detailedReport}
        reportId={reportId!}
        onBack={handleBack}
        componentUrl={componentUrl}
        metricsUrl={metricsUrl}
        chatContext={chatContext}
        onRecommendationApplied={refresh}
      />
    </Box>
  );
};

export const CostAnalysisReport = () => {
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

  return <CostAnalysisReportContent />;
};
