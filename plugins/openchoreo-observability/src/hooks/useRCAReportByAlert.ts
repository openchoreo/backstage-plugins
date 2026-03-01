import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { RCAReportDetailed } from '../types';

export function useRCAReport(
  reportId: string | undefined,
  environmentName: string | undefined,
  entity: Entity,
) {
  const observabilityApi = useApi(observabilityApiRef);
  const [report, setReport] = useState<RCAReportDetailed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';

  const fetchReport = useCallback(async () => {
    if (!reportId || !environmentName) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const reportData = await observabilityApi.getRCAReport(
        reportId,
        environmentName,
        namespace,
      );

      setReport(reportData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch RCA report',
      );
    } finally {
      setLoading(false);
    }
  }, [observabilityApi, reportId, environmentName, namespace]);

  // Auto-fetch report when dependencies are available
  useEffect(() => {
    if (reportId && environmentName) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, environmentName]);

  return {
    report,
    loading,
    error,
    refresh: fetchReport,
  };
}

/** @deprecated Use useRCAReport instead */
export const useRCAReportByAlert = useRCAReport;
