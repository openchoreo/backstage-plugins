import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';

export function useRCAReport(
  reportId: string | undefined,
  environmentName: string | undefined,
  entity: Entity,
) {
  const observabilityApi = useApi(observabilityApiRef);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    ['rca-report', reportId ?? null, environmentName ?? null, namespace],
    () => observabilityApi.getRCAReport(reportId!, environmentName!, namespace),
    {
      enabled: !!reportId && !!environmentName,
    },
  );

  return {
    report: data ?? null,
    loading,
    isRefetching,
    error: error ? error.message || 'Failed to fetch RCA report' : null,
    refresh: refetch,
  };
}
