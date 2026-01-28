import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { SummaryWidgetWrapper } from '@openchoreo/backstage-plugin-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import WifiIcon from '@material-ui/icons/Wifi';

/**
 * A standalone agent health widget for the homepage that shows
 * connected/disconnected plane agent counts across all plane types.
 */
export const AgentHealthWidget = () => {
  const [connectedCount, setConnectedCount] = useState<number>(0);
  const [disconnectedCount, setDisconnectedCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const catalogApi = useApi(catalogApiRef);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dataplaneResult, buildPlaneResult, obsPlaneResult] =
        await Promise.all([
          catalogApi.getEntities({ filter: { kind: 'Dataplane' } }),
          catalogApi.getEntities({ filter: { kind: 'BuildPlane' } }),
          catalogApi.getEntities({ filter: { kind: 'ObservabilityPlane' } }),
        ]);

      const allPlanes = [
        ...dataplaneResult.items,
        ...buildPlaneResult.items,
        ...obsPlaneResult.items,
      ];

      let connected = 0;
      let disconnected = 0;

      for (const entity of allPlanes) {
        const agentConnected =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.AGENT_CONNECTED];
        if (agentConnected === 'true') {
          connected++;
        } else {
          disconnected++;
        }
      }

      setConnectedCount(connected);
      setDisconnectedCount(disconnected);
      setTotalCount(allPlanes.length);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch agent health data',
      );
      setConnectedCount(0);
      setDisconnectedCount(0);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [catalogApi]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <SummaryWidgetWrapper
      icon={<WifiIcon fontSize="inherit" />}
      title="Agent Health"
      metrics={[
        {
          label: 'Connected planes:',
          value: connectedCount,
        },
        {
          label: 'Disconnected planes:',
          value: disconnectedCount,
        },
        {
          label: 'Total planes:',
          value: totalCount,
        },
      ]}
      loading={loading}
      errorMessage={error || undefined}
    />
  );
};
