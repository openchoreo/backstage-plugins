import { useCallback, useEffect, useState } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { observabilityApiRef } from '../api/ObservabilityApi';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { RCAReportDetailed } from '../types';

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

export function useRCAReportByAlert(
  alertId: string | undefined,
  environmentId: string | undefined,
  environmentName: string | undefined,
  entity: Entity,
) {
  const observabilityApi = useApi(observabilityApiRef);
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [report, setReport] = useState<RCAReportDetailed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  const fetchReport = useCallback(
    async (version?: number) => {
      if (!alertId || !environmentId || !environmentName || !projectId) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const reportData = await observabilityApi.getRCAReportByAlert(
          alertId,
          projectId,
          environmentId,
          environmentName,
          namespace || '',
          entity.metadata.name as string,
          version ? { version } : undefined,
        );

        setReport(reportData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch RCA report',
        );
      } finally {
        setLoading(false);
      }
    },
    [
      observabilityApi,
      alertId,
      environmentId,
      environmentName,
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

  // Auto-fetch report when dependencies are available
  useEffect(() => {
    if (projectId && alertId && environmentId && environmentName) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, alertId, environmentId, environmentName]);

  return {
    report,
    loading,
    error,
    refresh: fetchReport,
  };
}
