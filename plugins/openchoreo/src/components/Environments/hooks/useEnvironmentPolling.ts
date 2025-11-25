import { useEffect } from 'react';

/**
 * Hook for polling environments when deployments are pending.
 * Automatically polls every 10 seconds when isPending is true.
 */
export function useEnvironmentPolling(isPending: boolean, refetch: () => void) {
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isPending) {
      intervalId = setInterval(() => {
        refetch();
      }, 10000); // 10 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isPending, refetch]);
}
