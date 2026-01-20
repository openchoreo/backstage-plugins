import { useCallback, useEffect, useState } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Filters } from '../types';
import { Entity } from '@backstage/catalog-model';
import { Metrics } from '../types';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

async function getComponentDetails(
  entity: Entity,
  discovery: any,
  fetchApi: any,
): Promise<{ uid?: string }> {
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

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
  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

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

export function useMetrics(
  filters: Filters,
  entity: Entity,
  organization: string,
  project: string,
) {
  const observabilityApi = useApi(observabilityApiRef);
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [componentId, setComponentId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

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

  const fetchMetrics = useCallback(
    async (reset: boolean = false) => {
      if (
        !filters.environment ||
        !filters.environment.uid ||
        !filters.timeRange ||
        !componentId ||
        !projectId
      ) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const componentName =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
        if (!componentName) {
          throw new Error('Component name not found in entity annotations');
        }

        // Calculate the start and end times based on the time range
        const { startTime, endTime } = calculateTimeRange(filters.timeRange);

        const response = await observabilityApi.getMetrics(
          componentId,
          projectId,
          filters.environment.uid,
          filters.environment.name,
          componentName,
          organization,
          project,
          {
            limit: 100,
            offset: 0,
            startTime,
            endTime,
          },
        );

        if (reset || !metrics) {
          setMetrics(response);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch metrics',
        );
      } finally {
        setLoading(false);
      }
    },
    [
      observabilityApi,
      filters.environment,
      filters.timeRange,
      metrics,
      organization,
      project,
      componentId,
      projectId,
      entity,
    ],
  );

  const refresh = useCallback(() => {
    setMetrics(null);
    fetchMetrics(true);
  }, [fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    fetchMetrics,
    refresh,
    componentId,
    projectId,
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
