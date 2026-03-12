import { useCallback, useEffect, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { PlatformDetailsCard } from '../PlatformDetailsCard';
import { fetchDataplanesWithEnvironmentsAndComponents } from '../../api/dataplanesWithEnvironmentsAndComponents';
import {
  DataPlaneWithEnvironments,
  WorkflowPlane,
  ObservabilityPlane,
} from '../../types';
import { Box, CircularProgress, Typography } from '@material-ui/core';

/**
 * A standalone platform details card for the homepage that handles its own data fetching
 */
export const HomePagePlatformDetailsCard = () => {
  const [dataplanesWithEnvironments, setDataplanesWithEnvironments] = useState<
    DataPlaneWithEnvironments[]
  >([]);
  const [clusterDataplanes, setClusterDataplanes] = useState<
    DataPlaneWithEnvironments[]
  >([]);
  const [workflowPlanes, setWorkflowPlanes] = useState<WorkflowPlane[]>([]);
  const [clusterWorkflowPlanes, setClusterWorkflowPlanes] = useState<
    WorkflowPlane[]
  >([]);
  const [observabilityPlanes, setObservabilityPlanes] = useState<
    ObservabilityPlane[]
  >([]);
  const [clusterObservabilityPlanes, setClusterObservabilityPlanes] = useState<
    ObservabilityPlane[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const catalogApi = useApi(catalogApiRef);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        dataplanesData,
        dataplaneCatalogResult,
        workflowPlaneResult,
        obsPlaneResult,
        clusterDpResult,
        clusterBpResult,
        clusterOpResult,
      ] = await Promise.all([
        fetchDataplanesWithEnvironmentsAndComponents(
          discovery,
          fetchApi,
          catalogApi,
        ),
        catalogApi.getEntities({ filter: { kind: 'DataPlane' } }),
        catalogApi.getEntities({ filter: { kind: 'WorkflowPlane' } }),
        catalogApi.getEntities({ filter: { kind: 'ObservabilityPlane' } }),
        catalogApi.getEntities({ filter: { kind: 'ClusterDataplane' } }),
        catalogApi.getEntities({ filter: { kind: 'ClusterWorkflowPlane' } }),
        catalogApi.getEntities({
          filter: { kind: 'ClusterObservabilityPlane' },
        }),
      ]);

      // Build lookup map for dataplane agent status from catalog
      const dataplaneAgentMap = new Map<string, boolean>();
      dataplaneCatalogResult.items.forEach(entity => {
        const ns =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ||
          entity.metadata.namespace ||
          'default';
        const key = `${ns}/${entity.metadata.name}`;
        dataplaneAgentMap.set(
          key,
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.AGENT_CONNECTED] ===
            'true',
        );
      });

      // Enrich namespace-scoped dataplanes with agent status
      setDataplanesWithEnvironments(
        dataplanesData.map(dp => ({
          ...dp,
          agentConnected: dataplaneAgentMap.get(
            `${dp.namespaceName}/${dp.name}`,
          ),
        })),
      );

      // Cluster dataplanes
      setClusterDataplanes(
        clusterDpResult.items.map(entity => ({
          name: entity.metadata.name,
          namespace: entity.metadata.namespace,
          displayName: entity.metadata.title || entity.metadata.name,
          description: entity.metadata.description,
          namespaceName: 'openchoreo-cluster',
          agentConnected:
            entity.metadata.annotations?.[
              CHOREO_ANNOTATIONS.AGENT_CONNECTED
            ] === 'true',
          environments: [],
        })),
      );

      const mapWorkflowPlane = (
        entity: (typeof workflowPlaneResult.items)[0],
      ): WorkflowPlane => ({
        name: entity.metadata.name,
        namespace: entity.metadata.namespace,
        displayName: entity.metadata.title || entity.metadata.name,
        description: entity.metadata.description,
        namespaceName:
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ||
          entity.metadata.namespace ||
          'default',
        observabilityPlaneRef: (entity.spec as any)?.observabilityPlaneRef,
        status: entity.metadata.annotations?.[CHOREO_ANNOTATIONS.STATUS],
        agentConnected:
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.AGENT_CONNECTED] ===
          'true',
        agentConnectedCount: parseInt(
          entity.metadata.annotations?.[
            CHOREO_ANNOTATIONS.AGENT_CONNECTED_COUNT
          ] || '0',
          10,
        ),
      });

      setWorkflowPlanes(workflowPlaneResult.items.map(mapWorkflowPlane));
      setClusterWorkflowPlanes(clusterBpResult.items.map(mapWorkflowPlane));

      const mapObsPlane = (
        entity: (typeof obsPlaneResult.items)[0],
      ): ObservabilityPlane => ({
        name: entity.metadata.name,
        namespace: entity.metadata.namespace,
        displayName: entity.metadata.title || entity.metadata.name,
        description: entity.metadata.description,
        namespaceName:
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ||
          entity.metadata.namespace ||
          'default',
        observerURL: (entity.spec as any)?.observerURL,
        status: entity.metadata.annotations?.[CHOREO_ANNOTATIONS.STATUS],
        agentConnected:
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.AGENT_CONNECTED] ===
          'true',
        agentConnectedCount: parseInt(
          entity.metadata.annotations?.[
            CHOREO_ANNOTATIONS.AGENT_CONNECTED_COUNT
          ] || '0',
          10,
        ),
      });

      setObservabilityPlanes(obsPlaneResult.items.map(mapObsPlane));
      setClusterObservabilityPlanes(clusterOpResult.items.map(mapObsPlane));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch platform details',
      );
      setDataplanesWithEnvironments([]);
      setClusterDataplanes([]);
      setWorkflowPlanes([]);
      setClusterWorkflowPlanes([]);
      setObservabilityPlanes([]);
      setClusterObservabilityPlanes([]);
    } finally {
      setLoading(false);
    }
  }, [discovery, fetchApi, catalogApi]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={120}
      >
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={120}
      >
        <Typography variant="body2" color="error">
          Failed to load platform details
        </Typography>
      </Box>
    );
  }

  return (
    <PlatformDetailsCard
      dataplanesWithEnvironments={dataplanesWithEnvironments}
      clusterDataplanes={clusterDataplanes}
      workflowPlanes={workflowPlanes}
      clusterWorkflowPlanes={clusterWorkflowPlanes}
      observabilityPlanes={observabilityPlanes}
      clusterObservabilityPlanes={clusterObservabilityPlanes}
    />
  );
};
