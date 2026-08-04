import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import {
  openChoreoClientApiRef,
  PlatformVersion,
} from '../api/OpenChoreoClientApi';

interface UsePlatformVersionResult {
  version: PlatformVersion | undefined;
  loading: boolean;
  error: Error | null;
}

/**
 * Fetches the deployed OpenChoreo platform version. The version is immutable
 * for the lifetime of a deployment, so the result is cached for the session.
 */
export function usePlatformVersion(): UsePlatformVersionResult {
  const client = useApi(openChoreoClientApiRef);

  const { data, loading, error } = useOpenChoreoQuery(
    ['platform', 'version'],
    () => client.getPlatformVersion(),
    { staleTime: Infinity, retry: 1 },
  );

  return { version: data, loading, error };
}
