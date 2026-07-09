import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Filters } from '../types';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  calculateTimeRange,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';

export function useFinOpsReports(filters: Filters, entity: Entity) {
  const observabilityApi = useApi(observabilityApiRef);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';
  const projectName = entity.metadata.name as string;

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    [
      'finops-reports',
      namespace,
      projectName,
      filters.environment?.name,
      filters.timeRange,
      filters.rcaStatus,
    ],
    () => {
      const { startTime, endTime } = calculateTimeRange(filters.timeRange);

      return observabilityApi.getFinOpsReports(
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
    },
    {
      enabled: !!filters.environment && !!filters.timeRange && !!namespace,
    },
  );

  return {
    reports: data?.reports ?? [],
    loading,
    isRefetching,
    error: error
      ? error.message || 'Failed to fetch cost analysis reports'
      : null,
    refresh: refetch,
    totalCount: data?.totalCount,
  };
}
