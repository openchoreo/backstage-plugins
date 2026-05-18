import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Filters, FinOpsReportSummary } from '../types';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { calculateTimeRange } from '@openchoreo/backstage-plugin-react';

export function useFinOpsReports(filters: Filters, entity: Entity) {
  const observabilityApi = useApi(observabilityApiRef);
  const [reports, setReports] = useState<FinOpsReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';
  const projectName = entity.metadata.name as string;

  const fetchReports = useCallback(async () => {
    if (!filters.environment || !filters.timeRange || !namespace) {
      setReports([]);
      setTotalCount(undefined);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { startTime, endTime } = calculateTimeRange(filters.timeRange);

      const response = await observabilityApi.getFinOpsReports(
        namespace,
        projectName,
        filters.environment.name,
        {
          limit: 100,
          startTime,
          endTime,
          status: filters.rcaStatus,
        },
      );

      setReports(response.reports);
      setTotalCount(response.totalCount);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch cost analysis reports',
      );
    } finally {
      setLoading(false);
    }
  }, [
    observabilityApi,
    filters.environment,
    filters.timeRange,
    filters.rcaStatus,
    namespace,
    projectName,
  ]);

  // Auto-fetch reports when filters or entity scope change
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const refresh = useCallback(() => {
    fetchReports();
  }, [fetchReports]);

  return {
    reports,
    loading,
    error,
    refresh,
    totalCount,
  };
}
