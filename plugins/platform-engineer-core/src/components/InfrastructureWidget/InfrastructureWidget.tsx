import { useCallback, useEffect, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { fetchPlatformOverview } from '../../api/platformOverview';
import { SummaryWidgetWrapper } from '@openchoreo/backstage-plugin-react';
import InfrastructureIcon from '@material-ui/icons/Storage';
import BuildIcon from '@material-ui/icons/Build';
import VisibilityIcon from '@material-ui/icons/Visibility';
import CloudIcon from '@material-ui/icons/Cloud';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';

/**
 * A standalone infrastructure widget for the homepage that handles its own data fetching
 */
export const InfrastructureWidget = () => {
  const [totalDataplanes, setTotalDataplanes] = useState<number>(0);
  const [totalBuildPlanes, setTotalBuildPlanes] = useState<number>(0);
  const [totalObservabilityPlanes, setTotalObservabilityPlanes] =
    useState<number>(0);
  const [totalEnvironments, setTotalEnvironments] = useState<number>(0);
  const [healthyWorkloadCount, setHealthyWorkloadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const catalogApi = useApi(catalogApiRef);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [platformData, buildPlaneResult, obsPlaneResult] =
        await Promise.all([
          fetchPlatformOverview(discovery, fetchApi, catalogApi),
          catalogApi.getEntities({ filter: { kind: 'BuildPlane' } }),
          catalogApi.getEntities({ filter: { kind: 'ObservabilityPlane' } }),
        ]);

      setTotalDataplanes(platformData.dataplanes.length);
      setTotalEnvironments(platformData.environments.length);
      setHealthyWorkloadCount(platformData.healthyWorkloadCount);
      setTotalBuildPlanes(buildPlaneResult.items.length);
      setTotalObservabilityPlanes(obsPlaneResult.items.length);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch infrastructure data',
      );
      setTotalDataplanes(0);
      setTotalEnvironments(0);
      setHealthyWorkloadCount(0);
      setTotalBuildPlanes(0);
      setTotalObservabilityPlanes(0);
    } finally {
      setLoading(false);
    }
  }, [discovery, fetchApi, catalogApi]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          label: 'Build Planes',
          value: totalBuildPlanes,
          link: '/catalog?filters[kind]=buildplane',
          icon: <BuildIcon />,
        },
        {
          label: 'Observability',
          value: totalObservabilityPlanes,
          link: '/catalog?filters[kind]=observabilityplane',
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
      errorMessage={error || undefined}
    />
  );
};
