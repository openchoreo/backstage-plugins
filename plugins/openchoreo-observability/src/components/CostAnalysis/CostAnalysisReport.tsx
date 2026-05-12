import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography } from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import {
  useRcaPermission,
  ForbiddenState,
} from '@openchoreo/backstage-plugin-react';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  useFinOpsReport,
  useFilters,
  useGetEnvironmentsByNamespace,
} from '../../hooks';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { CostAnalysisReportView } from './CostAnalysisReportView';

const CostAnalysisReportContent = () => {
  const { reportId } = useParams<{ reportId?: string }>();
  const navigate = useNavigate();
  const { entity } = useEntity();
  const { filters } = useFilters();
  const namespace = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
  const projectName = entity.metadata.name as string;

  // Get environments to ensure we have environment data
  const { environments } = useGetEnvironmentsByNamespace(
    namespace,
    projectName,
  );
  const environment = filters.environment || environments[0];

  const {
    report: detailedReport,
    loading,
    error,
  } = useFinOpsReport(reportId, environment?.name, entity);

  if (loading) {
    return <Progress />;
  }

  if (error) {
    let errorMessage = error;
    let severity: 'info' | 'error' = 'error';

    if (error.includes('FinOps service is not configured')) {
      errorMessage =
        'FinOps Agent is not configured. Please enable it to view cost analysis reports.';
      severity = 'info';
    } else if (error.includes('Observability is not enabled')) {
      errorMessage =
        'Observability is not enabled for this environment. Please enable observability and enable the FinOps agent.';
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

  return (
    <CostAnalysisReportView
      report={detailedReport}
      reportId={reportId!}
      onBack={handleBack}
      componentUrl={componentUrl}
      metricsUrl={metricsUrl}
    />
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
