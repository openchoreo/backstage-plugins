import { useState, useEffect } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { extractInvokeUrl } from '../utils/invokeUrlUtils';
import { ReleaseData } from '../ReleaseDataRenderer/types';

const DEFAULT_HTTP_PORT = 19080;

/**
 * Custom hook to fetch and extract invoke URL for a deployed environment
 */
export function useInvokeUrl(
  entity: Entity,
  environmentName: string,
  resourceName: string | undefined,
  releaseName: string | undefined,
  status: 'Ready' | 'NotReady' | 'Failed' | undefined,
  dataPlaneRef: string | undefined,
) {
  const client = useApi(openChoreoClientApiRef);

  const [invokeUrl, setInvokeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInvokeUrl = async () => {
      // Only fetch if there's a deployment
      if (!releaseName || !status || status === 'Failed') {
        setInvokeUrl(null);
        return;
      }

      setLoading(true);
      try {
        // Extract organization name from entity
        const organizationName =
          entity.metadata.annotations?.['openchoreo.dev/organization'];

        // Fetch dataplane details if dataPlaneRef is provided
        let port = DEFAULT_HTTP_PORT;
        if (dataPlaneRef && organizationName) {
          try {
            const dataPlaneDetails = await client.fetchDataPlaneDetails(
              organizationName,
              dataPlaneRef,
            );
            // Use publicHTTPPort if available and not 0
            if (
              dataPlaneDetails?.publicHTTPPort &&
              dataPlaneDetails.publicHTTPPort !== 0
            ) {
              port = dataPlaneDetails.publicHTTPPort;
            }
          } catch (error) {
            // Fall back to default port if fetching dataplane details fails
            console.warn('Failed to fetch dataplane details, using default port:', error);
          }
        }

        const envName = resourceName || environmentName;
        const releaseData = (await client.fetchEnvironmentRelease(
          entity,
          envName,
        )) as ReleaseData;
        const url = extractInvokeUrl(releaseData, port);
        setInvokeUrl(url);
      } catch (error) {
        // Silently fail - invoke URL is optional
        setInvokeUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchInvokeUrl();
  }, [releaseName, status, environmentName, resourceName, dataPlaneRef, entity, client]);

  return { invokeUrl, loading };
}
