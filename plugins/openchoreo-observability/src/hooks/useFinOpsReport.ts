import { useApi } from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';

export function useFinOpsReport(
  reportId: string | undefined,
  environmentName: string | undefined,
  entity: Entity,
) {
  const observabilityApi = useApi(observabilityApiRef);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] || '';

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    ['finops-report', reportId ?? null, environmentName ?? null, namespace],
    () => {
      // Surface the missing-annotation case as an error (as the pre-cache hook
      // did) rather than silently gating it off — the report id/env are present,
      // so the user expects feedback.
      if (!namespace) {
        throw new Error('Missing required annotation: namespace');
      }
      return observabilityApi.getFinOpsReport(
        reportId!,
        environmentName!,
        namespace,
      );
    },
    {
      enabled: !!reportId && !!environmentName,
    },
  );

  return {
    report: data ?? null,
    loading,
    isRefetching,
    error: error
      ? error.message || 'Failed to fetch cost analysis report'
      : null,
    refresh: refetch,
  };
}
