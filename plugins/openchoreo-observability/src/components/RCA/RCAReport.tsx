import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography } from '@material-ui/core';
import { EmptyState, Progress, WarningIcon } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { useRcaPermission } from '@openchoreo/backstage-plugin-react';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  useRCAReport,
  useFilters,
  useGetEnvironmentsByNamespace,
} from '../../hooks';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { RCAReportView } from './RCAReport/RCAReportView';
import { useApi, discoveryApiRef } from '@backstage/core-plugin-api';
import { rcaAgentApiRef } from '../../api/RCAAgentApi';

const RCAReportContent = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { entity } = useEntity();
  const { filters } = useFilters();
  const rcaAgentApi = useApi(rcaAgentApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const namespace = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  // Get environments to ensure we have environment data
  const { environments } = useGetEnvironmentsByNamespace(namespace);
  const environment = filters.environment || environments[0];

  const {
    report: detailedReport,
    loading,
    error,
  } = useRCAReport(reportId, environment?.name, entity);

  const [backendBaseUrl, setBackendBaseUrl] = useState<string | undefined>();
  useEffect(() => {
    discoveryApi
      .getBaseUrl('openchoreo-observability-backend')
      .then(setBackendBaseUrl)
      .catch(() => {});
  }, [discoveryApi]);

  const chatContext = {
    namespaceName: namespace || '',
    environmentName: environment?.name || '',
    projectName: entity.metadata.name as string,
    rcaAgentApi,
    backendBaseUrl,
  };

  if (loading) {
    return <Progress />;
  }

  if (!reportId) {
    return (
      <Alert severity="error">
        <Typography variant="body1">Report ID is required</Typography>
      </Alert>
    );
  }

  if (error) {
    let errorMessage = error;
    let severity: 'info' | 'error' = 'error';

    if (error.includes('RCA service is not configured')) {
      errorMessage =
        'AI RCA is not configured. Please enable it to view RCA reports.';
      severity = 'info';
    } else if (error.includes('Observability is not enabled')) {
      errorMessage =
        'Observability is not enabled for this environment. Please enable observability and enable the AI RCA agent.';
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
    return null;
  }

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <RCAReportView
      report={detailedReport}
      reportId={reportId}
      onBack={handleBack}
      chatContext={chatContext}
    />
  );
};

export const RCAReport = () => {
  const {
    canViewRca,
    loading: permissionLoading,
    deniedTooltip,
  } = useRcaPermission();

  if (permissionLoading) {
    return <Progress />;
  }

  if (!canViewRca) {
    return (
      <EmptyState
        missing="data"
        title="Permission Denied"
        description={
          <Box display="flex" alignItems="center" gridGap={8}>
            <WarningIcon />
            {deniedTooltip}
          </Box>
        }
      />
    );
  }

  return <RCAReportContent />;
};
