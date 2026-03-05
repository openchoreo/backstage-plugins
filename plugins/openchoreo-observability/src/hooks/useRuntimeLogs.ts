import { useCallback, useEffect, useState, useRef } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Entity } from '@backstage/catalog-model';
import { LogEntry } from '../components/RuntimeLogs/types';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { calculateTimeRange } from '../components/RuntimeLogs/utils';

async function getComponentDetails(
  entity: Entity,
  discovery: any,
  fetchApi: any,
): Promise<{ uid?: string }> {
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const namespace = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  if (!component || !project || !namespace) {
    throw new Error(
      'Component name, project name, or namespace name not found in entity annotations',
    );
  }

  const backendUrl = new URL(
    `${await discovery.getBaseUrl('openchoreo')}/component`,
  );

  const params = new URLSearchParams({
    componentName: component,
    projectName: project,
    namespaceName: namespace,
  });

  backendUrl.search = params.toString();

  const response = await fetchApi.fetch(backendUrl.toString());

  if (!response.ok) {
    throw new Error(
      `Failed to fetch component details: ${response.status} ${response.statusText}`,
    );
  }

  const componentData = await response.json();
  return componentData;
}

async function getProjectDetails(
  entity: Entity,
  discovery: any,
  fetchApi: any,
): Promise<{ uid?: string }> {
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const namespace = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  if (!project || !namespace) {
    throw new Error(
      'Project name or namespace name not found in entity annotations',
    );
  }

  const backendUrl = new URL(
    `${await discovery.getBaseUrl('openchoreo')}/project`,
  );

  const params = new URLSearchParams({
    projectName: project,
    namespaceName: namespace,
  });

  backendUrl.search = params.toString();

  const response = await fetchApi.fetch(backendUrl.toString());

  if (!response.ok) {
    throw new Error(
      `Failed to fetch project details: ${response.status} ${response.statusText}`,
    );
  }

  const projectData = await response.json();
  return projectData;
}

export interface UseRuntimeLogsOptions {
  environmentId: string;
  environmentName: string;
  timeRange: string;
  logLevels?: string[];
  limit?: number;
  searchQuery?: string;
  sortOrder?: 'asc' | 'desc';
  isLive?: boolean;
}

export interface UseRuntimeLogsResult {
  logs: LogEntry[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  fetchLogs: (reset?: boolean) => Promise<void>;
  loadMore: () => void;
  refresh: () => void;
  componentId: string | null;
  projectId: string | null;
}

/**
 * Hook for fetching runtime logs for a component.
 * Follows the same pattern as useMetrics - fetches component and project IDs,
 * then calls the observability API with all required parameters.
 *
 * @param entity - The Backstage entity
 * @param namespaceName - Namespace name
 * @param project - Project name
 * @param options - Runtime logs options (environment, time range, log levels, etc.)
 * @returns Runtime logs data and control functions
 */
export function useRuntimeLogs(
  entity: Entity,
  namespaceName: string,
  project: string,
  options: UseRuntimeLogsOptions,
): UseRuntimeLogsResult {
  const observabilityApi = useApi(observabilityApiRef);
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [componentId, setComponentId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef<boolean>(false);

  // Fetch component and project IDs
  useEffect(() => {
    const fetchIds = async () => {
      try {
        const [componentDetails, projectDetails] = await Promise.all([
          getComponentDetails(entity, discovery, fetchApi),
          getProjectDetails(entity, discovery, fetchApi),
        ]);
        setComponentId(componentDetails.uid || null);
        setProjectId(projectDetails.uid || null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch component/project IDs',
        );
      }
    };

    fetchIds();
  }, [entity, discovery, fetchApi]);

  const fetchLogs = useCallback(
    async (reset: boolean = false) => {
      if (
        !options.environmentId ||
        !options.environmentName ||
        !componentId ||
        !projectId
      ) {
        return;
      }

      // Check if a fetch is already in progress
      if (inFlightRef.current) {
        return;
      }

      try {
        inFlightRef.current = true;
        setLoading(true);
        setError(null);

        const componentName =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
        if (!componentName) {
          throw new Error('Component name not found in entity annotations');
        }

        // Calculate the start and end times based on the time range
        const { startTime: initialStartTime, endTime: initialEndTime } =
          calculateTimeRange(options.timeRange);

        // Use timestamp-based pagination instead of offset
        let endTime = initialEndTime;
        let startTime = initialStartTime;
        if (!reset && logs.length > 0) {
          // For load more, use the timestamp of the last log as the new endTime or startTime based on the sort order
          const lastLog = logs[logs.length - 1];
          const sortOrder = options.sortOrder || 'desc';
          if (sortOrder === 'desc') {
            // For descending (newest first), use the timestamp of the last log as the new endTime
            endTime = lastLog.timestamp ?? endTime;
          } else {
            // For ascending (oldest first), use the timestamp of the last log as the new startTime
            startTime = lastLog.timestamp ?? startTime;
          }
        }

        const response = await observabilityApi.getRuntimeLogs(
          componentId,
          projectId,
          options.environmentId,
          namespaceName,
          project,
          options.environmentName,
          componentName,
          {
            limit: options.limit || 50,
            startTime,
            endTime,
            logLevels: options.logLevels,
            searchQuery: options.searchQuery,
            sortOrder: options.sortOrder || 'desc',
          },
        );

        if (reset) {
          setLogs(response.logs);
          setTotalCount(response.total ?? 0);
        } else {
          setLogs(prev => [...prev, ...response.logs]);
        }

        setHasMore(response.logs.length === (options.limit || 50));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      } finally {
        setLoading(false);
        inFlightRef.current = false;
      }
    },
    [
      observabilityApi,
      options.environmentId,
      options.environmentName,
      options.timeRange,
      options.logLevels,
      options.limit,
      options.searchQuery,
      options.sortOrder,
      logs,
      namespaceName,
      project,
      componentId,
      projectId,
      entity,
    ],
  );

  // Live polling effect
  useEffect(() => {
    // Always clear any existing interval first
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (
      !options.isLive ||
      !componentId ||
      !projectId ||
      !options.environmentId
    ) {
      return undefined;
    }

    // Set up polling interval (5 seconds)
    pollingIntervalRef.current = setInterval(() => {
      fetchLogs(true);
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      inFlightRef.current = false;
    };
  }, [
    options.isLive,
    componentId,
    projectId,
    options.environmentId,
    fetchLogs,
  ]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore && !error && logs.length > 0) {
      fetchLogs(false);
    }
  }, [fetchLogs, hasMore, loading, error, logs.length]);

  const refresh = useCallback(() => {
    setLogs([]);
    fetchLogs(true);
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    totalCount,
    hasMore,
    fetchLogs,
    loadMore,
    refresh,
    componentId,
    projectId,
  };
}
