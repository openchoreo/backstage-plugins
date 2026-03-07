import { useCallback, useEffect, useRef, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi, createApiRef } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
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
      status: 'triggered' | 'acknowledged' | 'resolved';
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
  const observabilityApi = useApi(observabilityApiRef);
  const [summaries, setSummaries] = useState<Map<string, IncidentsSummary>>(
    new Map(),
  );
  const requestIdRef = useRef(0);

  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const projectName = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  const fetchIncidents = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;

    if (!componentName || !projectName || !namespaceName) {
      setSummaries(new Map());
      return;
    }

    if (environments.length === 0) {
      setSummaries(new Map());
      return;
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    // Set loading state
    const loading = new Map<string, IncidentsSummary>();
    for (const env of environments) {
      loading.set(env.name, { activeCount: 0, loading: true });
    }
    setSummaries(loading);

    // Fetch in parallel
    const results = await Promise.allSettled(
      environments.map(async env => {
        const result = await observabilityApi.getIncidents(
          namespaceName,
          projectName,
          env.resourceName ?? env.name,
          componentName,
          {
            startTime: oneHourAgo.toISOString(),
            endTime: now.toISOString(),
            limit: 100,
          },
        );

        const activeCount = result.incidents.filter(
          i => i.status === 'triggered' || i.status === 'acknowledged',
        ).length;

        return { envName: env.name, activeCount };
      }),
    );

    // Ignore stale responses from superseded fetches
    if (currentRequestId !== requestIdRef.current) {
      return;
    }

    const final = new Map<string, IncidentsSummary>();
    for (let i = 0; i < environments.length; i++) {
      const env = environments[i];
      const result = results[i];
      if (result.status === 'fulfilled') {
        final.set(env.name, {
          activeCount: result.value.activeCount,
          loading: false,
        });
      } else {
        // Silently treat errors as no incidents (observability might not be configured)
        final.set(env.name, { activeCount: 0, loading: false });
      }
    }
    setSummaries(final);
  }, [
    observabilityApi,
    componentName,
    projectName,
    namespaceName,
    environments,
  ]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  return summaries;
}
