import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { fetchPlatformOverview } from '../../api/platformOverview';
import {
  SummaryWidgetWrapper,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';
import InfrastructureIcon from '@material-ui/icons/Storage';
import BuildIcon from '@material-ui/icons/Build';
import VisibilityIcon from '@material-ui/icons/Visibility';
import CloudIcon from '@material-ui/icons/Cloud';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';

interface InfrastructureCounts {
  totalDataplanes: number;
  totalClusterDataplanes: number;
  totalWorkflowPlanes: number;
  totalClusterWorkflowPlanes: number;
  totalObservabilityPlanes: number;
  totalClusterObservabilityPlanes: number;
  totalEnvironments: number;
  healthyWorkloadCount: number;
}

const EMPTY_COUNTS: InfrastructureCounts = {
  totalDataplanes: 0,
  totalClusterDataplanes: 0,
  totalWorkflowPlanes: 0,
  totalClusterWorkflowPlanes: 0,
  totalObservabilityPlanes: 0,
  totalClusterObservabilityPlanes: 0,
  totalEnvironments: 0,
  healthyWorkloadCount: 0,
};

/**
 * A standalone infrastructure widget for the homepage that handles its own data fetching
 */
export const InfrastructureWidget = () => {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const catalogApi = useApi(catalogApiRef);

  const { data, loading, isRefetching, error } =
    useOpenChoreoQuery<InfrastructureCounts>(
      ['platform-infrastructure', 'summary'],
      async () => {
        const [
          platformData,
          workflowPlaneResult,
          obsPlaneResult,
          clusterDpResult,
          clusterBpResult,
          clusterOpResult,
        ] = await Promise.all([
          fetchPlatformOverview(discovery, fetchApi, catalogApi),
          catalogApi.getEntities({ filter: { kind: 'WorkflowPlane' } }),
          catalogApi.getEntities({ filter: { kind: 'ObservabilityPlane' } }),
          catalogApi.getEntities({ filter: { kind: 'ClusterDataplane' } }),
          catalogApi.getEntities({ filter: { kind: 'ClusterWorkflowPlane' } }),
          catalogApi.getEntities({
            filter: { kind: 'ClusterObservabilityPlane' },
          }),
        ]);

        return {
          totalDataplanes: platformData.dataplanes.length,
          totalClusterDataplanes: clusterDpResult.items.length,
          totalEnvironments: platformData.environments.length,
          healthyWorkloadCount: platformData.healthyWorkloadCount,
          totalWorkflowPlanes: workflowPlaneResult.items.length,
          totalClusterWorkflowPlanes: clusterBpResult.items.length,
          totalObservabilityPlanes: obsPlaneResult.items.length,
          totalClusterObservabilityPlanes: clusterOpResult.items.length,
        };
      },
    );

  const {
    totalDataplanes,
    totalClusterDataplanes,
    totalWorkflowPlanes,
    totalClusterWorkflowPlanes,
    totalObservabilityPlanes,
    totalClusterObservabilityPlanes,
    totalEnvironments,
    healthyWorkloadCount,
  } = data ?? EMPTY_COUNTS;

  return (
    <SummaryWidgetWrapper
      icon={<InfrastructureIcon fontSize="inherit" />}
      title="Infrastructure"
      variant="cards"
      metrics={[
        {
          label: 'Data Planes',
          value: totalDataplanes,
          link: '/catalog?filters[kind]=dataplane',
          icon: <InfrastructureIcon />,
        },
        {
          label: 'Workflow Planes',
          value: totalWorkflowPlanes,
          link: '/catalog?filters[kind]=workflowplane',
          icon: <BuildIcon />,
        },
        {
          label: 'Observability',
          value: totalObservabilityPlanes,
          link: '/catalog?filters[kind]=observabilityplane',
          icon: <VisibilityIcon />,
        },
        {
          label: 'Cluster Data Planes',
          value: totalClusterDataplanes,
          link: '/catalog?filters[kind]=clusterdataplane',
          icon: <InfrastructureIcon />,
        },
        {
          label: 'Cluster Workflow Planes',
          value: totalClusterWorkflowPlanes,
          link: '/catalog?filters[kind]=clusterworkflowplane',
          icon: <BuildIcon />,
        },
        {
          label: 'Cluster Observability',
          value: totalClusterObservabilityPlanes,
          link: '/catalog?filters[kind]=clusterobservabilityplane',
          icon: <VisibilityIcon />,
        },
        {
          label: 'Environments',
          value: totalEnvironments,
          link: '/catalog?filters[kind]=environment',
          icon: <CloudIcon />,
        },
        {
          label: 'Healthy',
          value: healthyWorkloadCount,
          link: '/catalog?filters[kind]=component',
          icon: <CheckCircleIcon />,
        },
      ]}
      loading={loading}
      refreshing={isRefetching}
      errorMessage={
        error
          ? error.message || 'Failed to fetch infrastructure data'
          : undefined
      }
    />
  );
};
