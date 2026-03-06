import { useState, useEffect } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { extractInvokeUrlFromTree } from '../utils/invokeUrlUtils';

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
  releaseBindingName: string | undefined,
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
        const namespaceName =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

        // Fetch dataplane details if dataPlaneRef is provided
        let port = DEFAULT_HTTP_PORT;
        if (dataPlaneRef && namespaceName) {
          try {
            const dataPlaneDetails = await client.fetchDataPlaneDetails(
              namespaceName,
              dataPlaneRef,
            );
            // Use gateway HTTP port if it is a valid TCP port (1–65535)
            const rawPort =
              dataPlaneDetails?.gateway?.ingress?.external?.http?.port;
            const httpPort = Number(rawPort);
            if (
              Number.isInteger(httpPort) &&
              httpPort >= 1 &&
              httpPort <= 65535
            ) {
              port = httpPort;
            }
          } catch {
            // Fall back to default port if fetching dataplane details fails
          }
        }

        if (releaseBindingName && namespaceName) {
          const resourceTree = await client.fetchResourceTree(
            namespaceName,
            releaseBindingName,
          );
          const url = extractInvokeUrlFromTree(resourceTree, port);
          setInvokeUrl(url);
        } else {
          setInvokeUrl(null);
        }
      } catch {
        // Silently fail - invoke URL is optional
        setInvokeUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchInvokeUrl();
  }, [
    releaseName,
    status,
    environmentName,
    resourceName,
    dataPlaneRef,
    releaseBindingName,
    entity,
    client,
  ]);

  return { invokeUrl, loading };
}
