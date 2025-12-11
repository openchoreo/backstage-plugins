import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { RCAReportDetailed } from '../types';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export function useRCAReportByAlert(
  alertId: string | undefined,
  environmentId: string | undefined,
  environmentName: string | undefined,
  entity: Entity,
) {
  const observabilityApi = useApi(observabilityApiRef);

  const [report, setReport] = useState<RCAReportDetailed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];
  const projectName = entity.metadata.name as string;

  const fetchReport = useCallback(async () => {
    if (!alertId || !environmentId || !environmentName || !organization) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await observabilityApi.getRCAReportByAlert(
        alertId,
        environmentId,
        environmentName,
        organization,
        projectName,
      );

      setReport(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch RCA report',
      );
    } finally {
      setLoading(false);
    }
  }, [
    observabilityApi,
    alertId,
    environmentId,
    environmentName,
    organization,
    projectName,
  ]);

  // Auto-fetch when dependencies are ready
  useEffect(() => {
    if (alertId && environmentId && environmentName) {
      fetchReport();
    }
  }, [alertId, environmentId, environmentName, fetchReport]);

  const refresh = useCallback(() => {
    fetchReport();
  }, [fetchReport]);

  return {
    report,
    loading,
    error,
    refresh,
  };
}
