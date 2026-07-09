import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi, useApiHolder, createApiRef } from '@backstage/core-plugin-api';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { calculateTimeRange } from '../../../api/runtimeLogs';
import type { LogEntry, Environment, LogsResponse } from '../types';

/**
 * Local reference to the observability API registered by the
 * openchoreo-observability plugin. Using the same `id` ensures
 * Backstage resolves it to the same singleton instance at runtime,
 * without requiring a package dependency.
 */
interface ObservabilityLogsApi {
  getRuntimeLogs(
    namespaceName: string,
    projectName: string,
    environmentName: string,
    componentName: string,
    options?: {
      limit?: number;
      startTime?: string;
      endTime?: string;
      logLevels?: string[];
      searchQuery?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<LogsResponse>;
}

const observabilityApiRef = createApiRef<ObservabilityLogsApi>({
  id: 'plugin.openchoreo-observability.service',
});

interface LogsSummaryData {
  errorCount: number;
  warningCount: number;
  lastActivityTime: string | null;
}

const EMPTY: LogsSummaryData = {
  errorCount: 0,
  warningCount: 0,
  lastActivityTime: null,
};

/**
 * Hook for fetching log summary (error/warning counts) for the overview card.
 * Fetches logs from the last 1 hour and counts by level.
 */
export function useLogsSummary() {
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  // Optional — see note in useIncidentsSummary.ts. When the observability plugin is not
  // installed, useApiHolder().get() returns undefined and we treat it as
  // observability-disabled (the same state the backend sets when the cluster has
  // observability turned off).
  const observabilityApi = useApiHolder().get(observabilityApiRef);

  const { data, loading, isRefetching, error, refetch } =
    useOpenChoreoQuery<LogsSummaryData>(
      ['logs-summary', stringifyEntityRef(entity)],
      async () => {
        const environments: Environment[] = await client.getEnvironments(
          entity,
        );
        if (environments.length === 0) {
          return EMPTY;
        }

        // Use first environment (usually the default/primary).
        const selectedEnv = environments[0];
        const componentName =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
        const projectName =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
        const namespaceName =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

        if (!componentName || !projectName || !namespaceName) {
          throw new Error(
            'Component name, project, or namespace not found in annotations',
          );
        }

        const { startTime, endTime } = calculateTimeRange('1h');

        const logsResponse: LogsResponse =
          await observabilityApi!.getRuntimeLogs(
            namespaceName,
            projectName,
            selectedEnv.resourceName,
            componentName,
            { limit: 100, startTime, endTime, logLevels: [] },
          );

        const logs: LogEntry[] = logsResponse.logs || [];
        return {
          errorCount: logs.filter(log => log.level === 'ERROR').length,
          warningCount: logs.filter(log => log.level === 'WARN').length,
          lastActivityTime: logs.length > 0 ? logs[0].timestamp ?? null : null,
        };
      },
      { staleTime: 30_000, enabled: !!observabilityApi },
    );

  // "Observability disabled" = the plugin isn't installed (no API) OR the backend
  // reported it's turned off for this cluster (a specific error message). Both
  // suppress the error banner and just hide the summary.
  const observabilityDisabled =
    !observabilityApi ||
    (error?.message.includes('Observability is not enabled') ?? false);

  const errorCount = data?.errorCount ?? 0;
  const warningCount = data?.warningCount ?? 0;

  const getHealthStatus = (): 'healthy' | 'warning' | 'error' => {
    if (errorCount > 0) return 'error';
    if (warningCount > 0) return 'warning';
    return 'healthy';
  };

  return {
    errorCount,
    warningCount,
    lastActivityTime: data?.lastActivityTime ?? null,
    healthStatus: getHealthStatus(),
    loading,
    // Suppress the "observability disabled" pseudo-error from the real error slot.
    error: observabilityDisabled ? null : error,
    observabilityDisabled,
    refreshing: isRefetching,
    refresh: async () => {
      await refetch();
    },
  };
}
