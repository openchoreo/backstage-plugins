import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { FinOpsReportDetailed } from '../types';

export function useFinOpsReport(
  reportId: string | undefined,
  environmentName: string | undefined,
  entity: Entity,
) {
  const observabilityApi = useApi(observabilityApiRef);
  const [report, setReport] = useState<FinOpsReportDetailed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';

  const requestVersion = useRef(0);

  const fetchReport = useCallback(async () => {
    if (!reportId || !environmentName) {
      setLoading(false);
      setReport(null);
      setError(null);
      return;
    }

    if (!namespace) {
      setError('Missing required annotation: namespace');
      setLoading(false);
      return;
    }

    requestVersion.current += 1;
    const currentRequest = requestVersion.current;

    try {
      setLoading(true);
      setError(null);

      const reportData = await observabilityApi.getFinOpsReport(
        reportId,
        environmentName,
        namespace,
      );

      if (currentRequest !== requestVersion.current) return;
      setReport(reportData);
    } catch (err) {
      if (currentRequest !== requestVersion.current) return;
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch cost analysis report',
      );
    } finally {
      if (currentRequest === requestVersion.current) {
        setLoading(false);
      }
    }
  }, [observabilityApi, reportId, environmentName, namespace]);

  // Auto-fetch report when dependencies are available
  useEffect(() => {
    if (reportId && environmentName) {
      fetchReport();
    } else {
      setLoading(false);
      setReport(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, environmentName, namespace]);

  return {
    report,
    loading,
    error,
    refresh: fetchReport,
  };
}
