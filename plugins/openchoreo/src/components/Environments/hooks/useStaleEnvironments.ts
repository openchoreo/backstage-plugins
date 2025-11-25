import { useEffect, useState } from 'react';
import { Environment } from './useEnvironmentData';

/**
 * Hook for managing stale environment data during refreshes.
 * Shows cached data while new data is loading to prevent UI flicker.
 */
export function useStaleEnvironments(environments: Environment[]) {
  const [staleEnvironments, setStaleEnvironments] = useState<Environment[]>([]);

  useEffect(() => {
    if (environments.length > 0) {
      setStaleEnvironments(environments);
    }
  }, [environments]);

  const displayEnvironments =
    staleEnvironments.length > 0 ? staleEnvironments : environments;

  const isPending = displayEnvironments.some(
    env => env.deployment.status === 'NotReady',
  );

  return { displayEnvironments, isPending };
}
