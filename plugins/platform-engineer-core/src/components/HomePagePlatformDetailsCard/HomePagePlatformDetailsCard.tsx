import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { RefreshOverlay } from '@openchoreo/backstage-design-system';
import { PlatformDetailsCard } from '../PlatformDetailsCard';
import { fetchDataplanesWithEnvironmentsAndComponents } from '../../api/dataplanesWithEnvironmentsAndComponents';
import {
  DataPlaneWithEnvironments,
  WorkflowPlane,
  ObservabilityPlane,
} from '../../types';
import { Box, CircularProgress, Typography } from '@material-ui/core';

interface PlatformPlanes {
  dataplanesWithEnvironments: DataPlaneWithEnvironments[];
  clusterDataplanes: DataPlaneWithEnvironments[];
  workflowPlanes: WorkflowPlane[];
  clusterWorkflowPlanes: WorkflowPlane[];
  observabilityPlanes: ObservabilityPlane[];
  clusterObservabilityPlanes: ObservabilityPlane[];
}

const EMPTY_PLANES: PlatformPlanes = {
  dataplanesWithEnvironments: [],
  clusterDataplanes: [],
  workflowPlanes: [],
  clusterWorkflowPlanes: [],
  observabilityPlanes: [],
  clusterObservabilityPlanes: [],
};

/**
 * A standalone platform details card for the homepage that handles its own data fetching
 */
export const HomePagePlatformDetailsCard = () => {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const catalogApi = useApi(catalogApiRef);

  const { data, loading, isRefetching, error } =
    useOpenChoreoQuery<PlatformPlanes>(
      ['platform-details', 'planes'],
      async () => {
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
            entity.metadata.annotations?.[
              CHOREO_ANNOTATIONS.AGENT_CONNECTED
            ] === 'true',
          );
        });

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
            entity.metadata.annotations?.[
              CHOREO_ANNOTATIONS.AGENT_CONNECTED
            ] === 'true',
          agentConnectedCount: parseInt(
            entity.metadata.annotations?.[
              CHOREO_ANNOTATIONS.AGENT_CONNECTED_COUNT
            ] || '0',
            10,
          ),
        });

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
            entity.metadata.annotations?.[
              CHOREO_ANNOTATIONS.AGENT_CONNECTED
            ] === 'true',
          agentConnectedCount: parseInt(
            entity.metadata.annotations?.[
              CHOREO_ANNOTATIONS.AGENT_CONNECTED_COUNT
            ] || '0',
            10,
          ),
        });

        return {
          // Enrich namespace-scoped dataplanes with agent status.
          dataplanesWithEnvironments: dataplanesData.map(dp => ({
            ...dp,
            agentConnected: dataplaneAgentMap.get(
              `${dp.namespaceName}/${dp.name}`,
            ),
          })),
          clusterDataplanes: clusterDpResult.items.map(entity => ({
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
          workflowPlanes: workflowPlaneResult.items.map(mapWorkflowPlane),
          clusterWorkflowPlanes: clusterBpResult.items.map(mapWorkflowPlane),
          observabilityPlanes: obsPlaneResult.items.map(mapObsPlane),
          clusterObservabilityPlanes: clusterOpResult.items.map(mapObsPlane),
        };
      },
    );

  const planes = data ?? EMPTY_PLANES;

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
    <Box position="relative">
      <RefreshOverlay
        active={isRefetching}
        label="Refreshing platform details"
      />
      <PlatformDetailsCard
        dataplanesWithEnvironments={planes.dataplanesWithEnvironments}
        clusterDataplanes={planes.clusterDataplanes}
        workflowPlanes={planes.workflowPlanes}
        clusterWorkflowPlanes={planes.clusterWorkflowPlanes}
        observabilityPlanes={planes.observabilityPlanes}
        clusterObservabilityPlanes={planes.clusterObservabilityPlanes}
      />
    </Box>
  );
};
