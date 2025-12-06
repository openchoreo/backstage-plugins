import { useState, useEffect } from 'react';
import { Entity } from '@backstage/catalog-model';
import {
  discoveryApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { fetchEnvironmentRelease } from '../../../api/environments';
import { extractInvokeUrl } from '../utils/invokeUrlUtils';
import { ReleaseData } from '../ReleaseDataRenderer/types';

/**
 * Custom hook to fetch and extract invoke URL for a deployed environment
 */
export function useInvokeUrl(
  entity: Entity,
  environmentName: string,
  resourceName: string | undefined,
  releaseName: string | undefined,
  status: 'Ready' | 'NotReady' | 'Failed' | undefined,
) {
  const discovery = useApi(discoveryApiRef);
  const identity = useApi(identityApiRef);

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
        const envName = resourceName || environmentName;
        const releaseData = (await fetchEnvironmentRelease(
          entity,
          discovery,
          identity,
          envName,
        )) as ReleaseData;
        const url = extractInvokeUrl(releaseData);
        setInvokeUrl(url);
      } catch (error) {
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
    entity,
    discovery,
    identity,
  ]);

  return { invokeUrl, loading };
}
