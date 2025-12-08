import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import type { PendingAction } from '../types';

export type EnvironmentView =
  | 'list'
  | 'workload-config'
  | 'overrides'
  | 'release-details';

export interface EnvironmentRoutingState {
  view: EnvironmentView;
  envName?: string;
  pendingAction?: PendingAction;
}

/**
 * Serializes a PendingAction to URL search params
 */
function serializePendingAction(action: PendingAction): URLSearchParams {
  const params = new URLSearchParams();
  params.set('action', action.type);
  params.set('release', action.releaseName);
  params.set('target', action.targetEnvironment);

  if (action.type === 'promote') {
    params.set('source', action.sourceEnvironment);
  }

  return params;
}

/**
 * Deserializes a PendingAction from URL search params
 */
function deserializePendingAction(
  params: URLSearchParams,
): PendingAction | undefined {
  const type = params.get('action');
  const releaseName = params.get('release');
  const targetEnvironment = params.get('target');

  if (!type || !releaseName || !targetEnvironment) {
    return undefined;
  }

  if (type === 'deploy') {
    return { type: 'deploy', releaseName, targetEnvironment };
  }

  if (type === 'promote') {
    const sourceEnvironment = params.get('source');
    if (!sourceEnvironment) return undefined;
    return {
      type: 'promote',
      releaseName,
      sourceEnvironment,
      targetEnvironment,
    };
  }

  return undefined;
}

/**
 * Hook for managing Environments URL routing.
 *
 * Parses the current URL to determine which view is active and provides
 * navigation functions that update the URL.
 *
 * @example
 * ```tsx
 * const { state, navigateToOverrides, navigateToList } = useEnvironmentRouting();
 *
 * // Check current view
 * if (state.view === 'overrides') {
 *   console.log('Viewing overrides for:', state.envName);
 * }
 *
 * // Navigate to overrides
 * navigateToOverrides('production', pendingAction);
 * ```
 */
export function useEnvironmentRouting() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Derive current state from URL
  const state = useMemo<EnvironmentRoutingState>(() => {
    const path = location.pathname;

    if (path.endsWith('/workload-config')) {
      return { view: 'workload-config' };
    }

    // Check for overrides path: .../overrides/envName
    const overridesMatch = path.match(/\/overrides\/([^/]+)$/);
    if (overridesMatch) {
      const envName = decodeURIComponent(overridesMatch[1]);
      const pendingAction = deserializePendingAction(searchParams);

      return {
        view: 'overrides',
        envName,
        pendingAction,
      };
    }

    // Check for release details path: .../release/envName
    const releaseMatch = path.match(/\/release\/([^/]+)$/);
    if (releaseMatch) {
      const envName = decodeURIComponent(releaseMatch[1]);
      return { view: 'release-details', envName };
    }

    return { view: 'list' };
  }, [location.pathname, searchParams]);

  // Navigation helpers
  const navigateToList = useCallback(() => {
    navigate('.');
  }, [navigate]);

  const navigateToWorkloadConfig = useCallback(() => {
    navigate('../workload-config');
  }, [navigate]);

  const navigateToOverrides = useCallback(
    (envName: string, pendingAction?: PendingAction) => {
      const encodedEnvName = encodeURIComponent(envName.toLowerCase());
      let url = `../overrides/${encodedEnvName}`;

      if (pendingAction) {
        const params = serializePendingAction(pendingAction);
        url += `?${params.toString()}`;
      }

      navigate(url);
    },
    [navigate],
  );

  const navigateToReleaseDetails = useCallback(
    (envName: string) => {
      const encodedEnvName = encodeURIComponent(envName.toLowerCase());
      navigate(`../release/${encodedEnvName}`);
    },
    [navigate],
  );

  /**
   * Navigate back to the previous view.
   * Uses browser history by default.
   */
  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return {
    state,
    navigateToList,
    navigateToWorkloadConfig,
    navigateToOverrides,
    navigateToReleaseDetails,
    goBack,
  };
}
