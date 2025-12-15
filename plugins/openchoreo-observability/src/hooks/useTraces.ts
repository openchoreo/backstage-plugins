import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Filters, Trace } from '../types';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

async function getProjectDetails(
  entity: Entity,
  discovery: any,
  fetchApi: any,
): Promise<{ uid?: string }> {
  const project = entity.metadata.name as string;
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  if (!project || !organization) {
    throw new Error(
      'Project name or organization name not found in entity annotations',
    );
  }

  const backendUrl = new URL(
    `${await discovery.getBaseUrl('openchoreo')}/project`,
  );

  const params = new URLSearchParams({
    projectName: project,
    organizationName: organization,
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

export function useTraces(filters: Filters, entity: Entity) {
  const observabilityApi = useApi(observabilityApiRef);
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  // Memoize componentIds string for dependency array
  const componentIdsKey = useMemo(
    () => filters.componentIds?.join(',') || '',
    [filters.componentIds],
  );

  // Memoize filtered traces based on searchQuery
  const filteredTraces = useMemo(() => {
    if (!filters.searchQuery || filters.searchQuery.trim() === '') {
      return traces;
    }
    const searchLower = filters.searchQuery.toLowerCase().trim();
    return traces.filter(trace =>
      trace.traceId.toLowerCase().includes(searchLower),
    );
  }, [traces, filters.searchQuery]);

  const fetchTraces = useCallback(
    async (reset: boolean = false) => {
      if (
        !filters.environment ||
        !filters.environment.uid ||
        !filters.timeRange ||
        !projectId
      ) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Calculate the start and end times based on the time range
        const { startTime, endTime } = calculateTimeRange(filters.timeRange);

        // Get component UIDs from filters (empty array means all components)
        const componentUids = filters.componentIds || [];

        const response = await observabilityApi.getTraces(
          projectId,
          filters.environment.uid,
          filters.environment.name,
          organization || '',
          entity.metadata.name as string,
          componentUids,
          {
            limit: 100,
            startTime,
            endTime,
            sortOrder: 'desc',
          },
        );

        if (reset || !traces || traces.length === 0) {
          setTraces(response.traces);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch traces');
      } finally {
        setLoading(false);
      }
    },
    [
      observabilityApi,
      filters.environment,
      filters.timeRange,
      filters.componentIds,
      traces,
      organization,
      projectId,
      entity,
    ],
  );

  // Fetch project ID
  useEffect(() => {
    const fetchIds = async () => {
      try {
        const projectDetails = await getProjectDetails(
          entity,
          discovery,
          fetchApi,
        );
        setProjectId(projectDetails.uid || null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch project ID',
        );
      }
    };

    fetchIds();
  }, [entity, discovery, fetchApi]);

  // Auto-fetch traces when filters change
  useEffect(() => {
    if (projectId && filters.environment && filters.timeRange) {
      fetchTraces(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filters.environment, filters.timeRange, componentIdsKey]);

  const refresh = useCallback(() => {
    setTraces([]);
    fetchTraces(true);
  }, [fetchTraces]);

  return {
    traces: filteredTraces,
    loading,
    error,
    refresh,
  };
}

function calculateTimeRange(timeRange: string): {
  startTime: string;
  endTime: string;
} {
  const now = new Date();
  const endTime = now.toISOString();

  let startTime: Date;

  switch (timeRange) {
    case '10m':
      startTime = new Date(now.getTime() - 10 * 60 * 1000);
      break;
    case '30m':
      startTime = new Date(now.getTime() - 30 * 60 * 1000);
      break;
    case '1h':
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '14d':
      startTime = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(now.getTime() - 60 * 60 * 1000); // Default to 1 hour
  }

  return {
    startTime: startTime.toISOString(),
    endTime,
  };
}
