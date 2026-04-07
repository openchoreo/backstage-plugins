import { useEffect } from 'react';
import type { Environment } from '../types';

/**
 * Automatically selects the first available environment in the URL query params
 * when no valid environment is selected. Used by all URL filter hooks.
 */
export function useAutoSelectFirstEnvironment(
  environments: Environment[],
  searchParams: URLSearchParams,
  setSearchParams: (
    params: URLSearchParams,
    options?: { replace?: boolean },
  ) => void,
) {
  useEffect(() => {
    if (environments.length === 0) return;
    const envParam = searchParams.get('env');
    const matchedEnvironment = envParam
      ? environments.find(
          e =>
            e.name === envParam ||
            e.displayName === envParam ||
            e.name.toLowerCase() === envParam.toLowerCase(),
        )
      : undefined;

    if (!matchedEnvironment) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('env', environments[0].name);
      setSearchParams(newParams, { replace: true });
      return;
    }

    // Canonicalize to exact environment name for downstream exact-name consumers.
    if (envParam !== matchedEnvironment.name) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('env', matchedEnvironment.name);
      setSearchParams(newParams, { replace: true });
    }
  }, [environments, searchParams, setSearchParams]);
}
