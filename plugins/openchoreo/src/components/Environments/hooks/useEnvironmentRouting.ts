import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  buildEnvironmentsBasePath,
  buildOverridesPath,
  buildReleaseDetailsPath,
  buildWorkloadConfigPath,
  deserializePendingAction,
  type PendingAction,
} from '@openchoreo/backstage-plugin-react';

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
  const { entity } = useEntity();

  // Get absolute base path for environments
  const basePath = useMemo(() => buildEnvironmentsBasePath(entity), [entity]);

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

  // Navigation helpers using absolute paths
  const navigateToList = useCallback(() => {
    navigate(basePath);
  }, [navigate, basePath]);

  const navigateToWorkloadConfig = useCallback(() => {
    navigate(buildWorkloadConfigPath(basePath));
  }, [navigate, basePath]);

  const navigateToOverrides = useCallback(
    (envName: string, pendingAction?: PendingAction) => {
      navigate(buildOverridesPath(basePath, envName, pendingAction));
    },
    [navigate, basePath],
  );

  const navigateToReleaseDetails = useCallback(
    (envName: string) => {
      navigate(buildReleaseDetailsPath(basePath, envName));
    },
    [navigate, basePath],
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
