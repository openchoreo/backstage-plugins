import { useCallback, useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { calculateTimeRange } from '../../../api/runtimeLogs';
import type { LogEntry, Environment, LogsResponse } from '../types';

interface LogsSummaryState {
  errorCount: number;
  warningCount: number;
  lastActivityTime: string | null;
  loading: boolean;
  error: Error | null;
  observabilityDisabled: boolean;
  refreshing: boolean;
}

/**
 * Hook for fetching log summary (error/warning counts) for the overview card.
 * Fetches logs from the last 1 hour and counts by level.
 */
export function useLogsSummary() {
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [state, setState] = useState<LogsSummaryState>({
    errorCount: 0,
    warningCount: 0,
    lastActivityTime: null,
    loading: true,
    error: null,
    observabilityDisabled: false,
    refreshing: false,
  });

  const fetchData = useCallback(async () => {
    try {
      // Get component ID first
      const componentDetails = await client.getComponentDetails(entity);
      const componentId = componentDetails.uid;

      if (!componentId) {
        throw new Error('Component ID not found');
      }

      // Get project ID
      const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
      const namespace =
        entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

      if (!project || !namespace) {
        throw new Error('Project or namespace not found in annotations');
      }

      // Fetch project details to get projectId
      const projectUrl = new URL(
        `${await discoveryApi.getBaseUrl('openchoreo')}/project`,
      );
      projectUrl.search = new URLSearchParams({
        projectName: project,
        namespaceName: namespace,
      }).toString();

      const projectResponse = await fetchApi.fetch(projectUrl.toString());
      if (!projectResponse.ok) {
        throw new Error('Failed to fetch project details');
      }
      const projectData = await projectResponse.json();
      const projectId = projectData.uid;

      if (!projectId) {
        throw new Error('Project ID not found');
      }

      // Get environments
      const environments: Environment[] = await client.getEnvironments(entity);

      if (environments.length === 0) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: null,
        }));
        return;
      }

      // Use first environment (usually the default/primary)
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

      // Call observability backend directly
      const baseUrl = await discoveryApi.getBaseUrl(
        'openchoreo-observability-backend',
      );
      const url = new URL(
        `${baseUrl}/logs/component/${componentName}?namespaceName=${encodeURIComponent(
          namespaceName,
        )}&projectName=${encodeURIComponent(projectName)}`,
      );

      const response = await fetchApi.fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          componentId,
          projectId,
          environmentId: selectedEnv.id,
          environmentName: selectedEnv.resourceName,
          componentName,
          namespaceName,
          projectName,
          options: {
            limit: 100, // Limit for performance, we just need counts
            startTime,
            endTime,
            logLevels: [], // Get all levels
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (
          errorData.message?.includes('Observability is not enabled') ||
          response.status === 404
        ) {
          throw new Error('Observability is not enabled for this component');
        }
        throw new Error(
          `Failed to fetch runtime logs: ${response.status} ${response.statusText}`,
        );
      }

      const data: LogsResponse = await response.json();

      // Count errors and warnings
      const logs: LogEntry[] = data.logs || [];
      const errorCount = logs.filter(log => log.logLevel === 'ERROR').length;
      const warningCount = logs.filter(log => log.logLevel === 'WARN').length;

      // Get last activity time (most recent log)
      const lastActivityTime = logs.length > 0 ? logs[0].timestamp : null;

      setState(prev => ({
        ...prev,
        errorCount,
        warningCount,
        lastActivityTime,
        loading: false,
        error: null,
        observabilityDisabled: false,
      }));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch logs';

      // Check if observability is disabled
      if (errorMessage.includes('Observability is not enabled')) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: null,
          observabilityDisabled: true,
        }));
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: err as Error,
        }));
      }
    }
  }, [entity, client, discoveryApi, fetchApi]);

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, refreshing: true }));
    try {
      await fetchData();
    } finally {
      setState(prev => ({ ...prev, refreshing: false }));
    }
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Determine health status based on error/warning counts
  const getHealthStatus = (): 'healthy' | 'warning' | 'error' => {
    if (state.errorCount > 0) return 'error';
    if (state.warningCount > 0) return 'warning';
    return 'healthy';
  };

  return {
    errorCount: state.errorCount,
    warningCount: state.warningCount,
    lastActivityTime: state.lastActivityTime,
    healthStatus: getHealthStatus(),
    loading: state.loading,
    error: state.error,
    observabilityDisabled: state.observabilityDisabled,
    refreshing: state.refreshing,
    refresh,
  };
}
