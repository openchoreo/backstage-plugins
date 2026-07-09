import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  SummaryWidgetWrapper,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import WifiIcon from '@material-ui/icons/Wifi';

interface AgentHealthCounts {
  connectedCount: number;
  disconnectedCount: number;
  totalCount: number;
}

const EMPTY_COUNTS: AgentHealthCounts = {
  connectedCount: 0,
  disconnectedCount: 0,
  totalCount: 0,
};

/**
 * A standalone agent health widget for the homepage that shows
 * connected/disconnected plane agent counts across all plane types.
 */
export const AgentHealthWidget = () => {
  const catalogApi = useApi(catalogApiRef);

  const { data, loading, isRefetching, error } =
    useOpenChoreoQuery<AgentHealthCounts>(
      ['platform-agent-health'],
      async () => {
        const [dataplaneResult, workflowPlaneResult, obsPlaneResult] =
          await Promise.all([
            catalogApi.getEntities({ filter: { kind: 'Dataplane' } }),
            catalogApi.getEntities({ filter: { kind: 'WorkflowPlane' } }),
            catalogApi.getEntities({ filter: { kind: 'ObservabilityPlane' } }),
          ]);

        const allPlanes = [
          ...dataplaneResult.items,
          ...workflowPlaneResult.items,
          ...obsPlaneResult.items,
        ];

        let connected = 0;
        let disconnected = 0;
        for (const entity of allPlanes) {
          if (
            entity.metadata.annotations?.[
              CHOREO_ANNOTATIONS.AGENT_CONNECTED
            ] === 'true'
          ) {
            connected++;
          } else {
            disconnected++;
          }
        }

        return {
          connectedCount: connected,
          disconnectedCount: disconnected,
          totalCount: allPlanes.length,
        };
      },
    );

  const { connectedCount, disconnectedCount, totalCount } =
    data ?? EMPTY_COUNTS;

  return (
    <SummaryWidgetWrapper
      icon={<WifiIcon fontSize="inherit" />}
      title="Agent Health"
      metrics={[
        {
          label: 'Connected planes:',
          value: connectedCount,
          highlight: true,
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
      refreshing={isRefetching}
      errorMessage={
        error ? error.message || 'Failed to fetch agent health data' : undefined
      }
    />
  );
};
