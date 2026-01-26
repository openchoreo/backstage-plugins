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

/**
 * A standalone infrastructure widget for the homepage that handles its own data fetching
 */
export const InfrastructureWidget = () => {
  const [totalDataplanes, setTotalDataplanes] = useState<number>(0);
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

      const platformData = await fetchPlatformOverview(
        discovery,
        fetchApi,
        catalogApi,
      );

      setTotalDataplanes(platformData.dataplanes.length);
      setTotalEnvironments(platformData.environments.length);
      setHealthyWorkloadCount(platformData.healthyWorkloadCount);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch infrastructure data',
      );
      setTotalDataplanes(0);
      setTotalEnvironments(0);
      setHealthyWorkloadCount(0);
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
      metrics={[
        {
          label: 'Data planes connected:',
          value: totalDataplanes,
          link: '/catalog?filters[kind]=dataplane',
        },
        {
          label: 'Environments:',
          value: totalEnvironments,
          link: '/catalog?filters[kind]=environment',
        },
        {
          label: 'Healthy workloads:',
          value: healthyWorkloadCount,
          link: '/catalog?filters[kind]=component',
        },
      ]}
      loading={loading}
      errorMessage={error || undefined}
    />
  );
};
