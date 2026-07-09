import { useMemo } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApiHolder, createApiRef } from '@backstage/core-plugin-api';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import type { Environment } from './useEnvironmentData';

interface ObservabilityIncidentsApi {
  getIncidents(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName: string,
    options?: {
      startTime?: string;
      endTime?: string;
      limit?: number;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<{
    incidents: Array<{
      incidentId: string;
      alertId: string;
      status: 'active' | 'acknowledged' | 'resolved';
      description?: string;
      triggeredAt?: string;
      resolvedAt?: string;
    }>;
    total: number;
  }>;
}

const observabilityApiRef = createApiRef<ObservabilityIncidentsApi>({
  id: 'plugin.openchoreo-observability.service',
});

export interface IncidentsSummary {
  activeCount: number;
  loading: boolean;
}

export function useIncidentsSummary(
  environments: Environment[],
): Map<string, IncidentsSummary> {
  const { entity } = useEntity();
  // Observability is optional. When @openchoreo/backstage-plugin-openchoreo-observability
  // is not installed in the host app, no API factory is registered for this ref and
  // `useApi()` would throw NotImplementedError. `useApiHolder().get()` returns undefined
  // instead, letting the Deploy tab render without incident chips.
  const observabilityApi = useApiHolder().get(observabilityApiRef);

  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const projectName = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  const envNames = environments.map(e => e.name).join(',');

  const { data, loading } = useOpenChoreoQuery<Map<string, number>>(
    [
      'incidents-summary',
      stringifyEntityRef(entity),
      componentName ?? null,
      projectName ?? null,
      namespaceName ?? null,
      envNames,
    ],
    async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);

      // Fan out one getIncidents per environment; a per-env failure degrades to
      // zero (observability may be partially configured) rather than failing the
      // whole batch — same as the pre-cache Promise.allSettled behaviour.
      const results = await Promise.allSettled(
        environments.map(async env => {
          const result = await observabilityApi!.getIncidents(
            namespaceName!,
            projectName!,
            env.resourceName ?? env.name,
            componentName!,
            {
              startTime: oneHourAgo.toISOString(),
              endTime: now.toISOString(),
              limit: 100,
            },
          );
          const activeCount = result.incidents.filter(
            i => i.status === 'active',
          ).length;
          return { envName: env.name, activeCount };
        }),
      );

      const counts = new Map<string, number>();
      environments.forEach((env, i) => {
        const result = results[i];
        counts.set(
          env.name,
          result.status === 'fulfilled' ? result.value.activeCount : 0,
        );
      });
      return counts;
    },
    {
      // Freshness matches the old 1h window intent; short so revisits refresh.
      staleTime: 30_000,
      enabled:
        !!observabilityApi &&
        !!componentName &&
        !!projectName &&
        !!namespaceName &&
        environments.length > 0,
    },
  );

  // Rebuild the Map<envName, {activeCount, loading}> the Deploy tab expects.
  return useMemo(() => {
    const summaries = new Map<string, IncidentsSummary>();
    for (const env of environments) {
      summaries.set(env.name, {
        activeCount: data?.get(env.name) ?? 0,
        loading,
      });
    }
    return summaries;
  }, [environments, data, loading]);
}
