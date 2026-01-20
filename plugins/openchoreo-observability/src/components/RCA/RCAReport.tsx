import { useParams, useNavigate } from 'react-router-dom';
import { Typography } from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  useRCAReportByAlert,
  useFilters,
  useGetEnvironmentsByNamespace,
} from '../../hooks';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { RCAReportView } from './RCAReport/RCAReportView';

export const RCAReport = () => {
  const { alertId } = useParams<{ alertId: string }>();
  const navigate = useNavigate();
  const { entity } = useEntity();
  const { filters } = useFilters();
  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  // Get environments to ensure we have environment data
  const { environments } = useGetEnvironmentsByNamespace(namespace);
  const environment = filters.environment || environments[0];

  const {
    report: detailedReport,
    loading,
    error,
  } = useRCAReportByAlert(alertId, environment?.uid, environment?.name, entity);

  if (loading) {
    return <Progress />;
  }

  if (!alertId) {
    return (
      <Alert severity="error">
        <Typography variant="body1">Alert ID is required</Typography>
      </Alert>
    );
  }

  if (error) {
    let errorMessage = error;
    let severity: 'info' | 'error' = 'error';

    if (error.includes('RCA service is not enabled')) {
      errorMessage =
        'AI-powered RCA is not enabled. Please enable it to view RCA reports.';
      severity = 'info';
    } else if (error.includes('Observability is not enabled')) {
      errorMessage =
        'Observability is not enabled for this component. Please enable observability to view RCA reports.';
      severity = 'info';
    }

    return (
      <Alert severity={severity}>
        <Typography variant="body1">{errorMessage}</Typography>
      </Alert>
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
      alertId={alertId}
      onBack={handleBack}
    />
  );
};
