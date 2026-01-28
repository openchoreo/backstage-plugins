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
  BuildPlane,
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
  const [buildPlanes, setBuildPlanes] = useState<BuildPlane[]>([]);
  const [observabilityPlanes, setObservabilityPlanes] = useState<
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
        buildPlaneResult,
        obsPlaneResult,
      ] = await Promise.all([
        fetchDataplanesWithEnvironmentsAndComponents(
          discovery,
          fetchApi,
          catalogApi,
        ),
        catalogApi.getEntities({ filter: { kind: 'DataPlane' } }),
        catalogApi.getEntities({ filter: { kind: 'BuildPlane' } }),
        catalogApi.getEntities({ filter: { kind: 'ObservabilityPlane' } }),
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

      // Enrich dataplanes with agent status
      setDataplanesWithEnvironments(
        dataplanesData.map(dp => ({
          ...dp,
          agentConnected: dataplaneAgentMap.get(
            `${dp.namespaceName}/${dp.name}`,
          ),
        })),
      );

      setBuildPlanes(
        buildPlaneResult.items.map(entity => ({
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
        })),
      );

      setObservabilityPlanes(
        obsPlaneResult.items.map(entity => ({
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
        })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch platform details',
      );
      setDataplanesWithEnvironments([]);
      setBuildPlanes([]);
      setObservabilityPlanes([]);
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
      buildPlanes={buildPlanes}
      observabilityPlanes={observabilityPlanes}
    />
  );
};
