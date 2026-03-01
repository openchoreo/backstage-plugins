import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Filters, RCAReportSummary } from '../types';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { calculateTimeRange } from '@openchoreo/backstage-plugin-react';

export function useRCAReports(filters: Filters, entity: Entity) {
  const observabilityApi = useApi(observabilityApiRef);
  const [reports, setReports] = useState<RCAReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';
  const projectName = entity.metadata.name as string;

  const fetchReports = useCallback(async () => {
    if (!filters.environment || !filters.timeRange) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { startTime, endTime } = calculateTimeRange(filters.timeRange);

      const response = await observabilityApi.getRCAReports(
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
        err instanceof Error ? err.message : 'Failed to fetch RCA reports',
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

  // Auto-fetch reports when filters change
  useEffect(() => {
    if (filters.environment && filters.timeRange) {
      fetchReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.environment, filters.timeRange, filters.rcaStatus]);

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
