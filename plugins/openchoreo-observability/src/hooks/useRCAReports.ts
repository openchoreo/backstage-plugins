import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Filters } from '../types';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  calculateTimeRange,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';

export function useRCAReports(filters: Filters, entity: Entity) {
  const observabilityApi = useApi(observabilityApiRef);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';
  const projectName = entity.metadata.name as string;

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    [
      'rca-reports',
      namespace,
      projectName,
      filters.environment?.name,
      filters.timeRange,
      filters.customStartTime,
      filters.customEndTime,
      filters.rcaStatus,
    ],
    () => {
      const { startTime, endTime } = calculateTimeRange(filters.timeRange, {
        startTime: filters.customStartTime,
        endTime: filters.customEndTime,
      });

      return observabilityApi.getRCAReports(
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
    error: error ? error.message || 'Failed to fetch RCA reports' : null,
    refresh: refetch,
    totalCount: data?.totalCount,
  };
}
