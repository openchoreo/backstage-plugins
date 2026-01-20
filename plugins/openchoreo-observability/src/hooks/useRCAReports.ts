import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Filters, RCAReportSummary } from '../types';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { calculateTimeRange } from '@openchoreo/backstage-plugin-react';

async function getProjectDetails(
  entity: Entity,
  discovery: any,
  fetchApi: any,
): Promise<{ uid?: string }> {
  const project = entity.metadata.name as string;
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

export function useRCAReports(filters: Filters, entity: Entity) {
  const observabilityApi = useApi(observabilityApiRef);
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [reports, setReports] = useState<RCAReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  // Memoize componentIds string for dependency array
  const componentIdsKey = useMemo(
    () => filters.componentIds?.join(',') || '',
    [filters.componentIds],
  );

  const fetchReports = useCallback(
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

        const response = await observabilityApi.getRCAReports(
          projectId,
          filters.environment.uid,
          filters.environment.name,
          namespace || '',
          entity.metadata.name as string,
          componentUids,
          {
            limit: 100,
            startTime,
            endTime,
            status: filters.rcaStatus,
          },
        );

        if (reset || !reports || reports.length === 0) {
          setReports(response.reports);
          setTotalCount(response.totalCount);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch RCA reports',
        );
      } finally {
        setLoading(false);
      }
    },
    [
      observabilityApi,
      filters.environment,
      filters.timeRange,
      filters.componentIds,
      filters.rcaStatus,
      reports,
      namespace,
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

  // Auto-fetch reports when filters change
  useEffect(() => {
    if (projectId && filters.environment && filters.timeRange) {
      fetchReports(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    projectId,
    filters.environment,
    filters.timeRange,
    filters.rcaStatus,
    componentIdsKey,
  ]);

  const refresh = useCallback(() => {
    setReports([]);
    fetchReports(true);
  }, [fetchReports]);

  return {
    reports,
    loading,
    error,
    refresh,
    totalCount,
  };
}
