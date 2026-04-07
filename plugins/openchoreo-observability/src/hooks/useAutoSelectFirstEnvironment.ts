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
    const isValid = envParam && environments.some(e => e.name === envParam);
    if (!isValid) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('env', environments[0].name);
      setSearchParams(newParams, { replace: true });
    }
  }, [environments, searchParams, setSearchParams]);
}
