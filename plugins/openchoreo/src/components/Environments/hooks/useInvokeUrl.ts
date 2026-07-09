import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
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

  const { data, loading, isRefetching } = useOpenChoreoQuery(
    [
      'invoke-url',
      stringifyEntityRef(entity),
      environmentName,
      resourceName,
      releaseName,
      status,
      dataPlaneRef,
      releaseBindingName,
    ],
    async (): Promise<string | null> => {
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
          return extractInvokeUrlFromTree(resourceTree, port);
        }
        return null;
      } catch {
        // Silently fail - invoke URL is optional
        return null;
      }
    },
    // Only fetch if there's a deployment
    { enabled: !!releaseName && !!status && status !== 'Failed' },
  );

  return { invokeUrl: data ?? null, loading, isRefetching };
}
