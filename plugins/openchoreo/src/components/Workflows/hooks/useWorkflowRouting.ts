import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';

export type WorkflowTab = 'runs' | 'configurations';
export type RunDetailsTab = 'logs' | 'details';

export type WorkflowView = 'list' | 'config' | 'run-details';

export interface WorkflowRoutingState {
  view: WorkflowView;
  /** Active tab in list view */
  tab: WorkflowTab;
  /** Run ID when viewing run details */
  runId?: string;
  /** Active tab in run details view */
  runDetailsTab: RunDetailsTab;
}

/**
 * Hook for managing Workflows URL routing.
 *
 * Route structure:
 * - / or ?tab=runs - List view, runs tab (default)
 * - ?tab=configurations - List view, configurations tab
 * - /config - Config edit page
 * - /run/:runId - Run details page
 * - /run/:runId?tab=logs - Run details with logs tab (default)
 * - /run/:runId?tab=details - Run details with details tab
 *
 * @example
 * ```tsx
 * const { state, setTab, navigateToRunDetails } = useWorkflowRouting();
 *
 * // Check current view and tab
 * if (state.view === 'list') {
 *   console.log('Active tab:', state.tab);
 * }
 *
 * // Navigate to run details
 * navigateToRunDetails('build-123');
 * ```
 */
export function useWorkflowRouting() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive current state from URL
  const state = useMemo<WorkflowRoutingState>(() => {
    const path = location.pathname;

    // Check for config page
    if (path.endsWith('/config')) {
      return {
        view: 'config',
        tab: 'configurations',
        runDetailsTab: 'logs',
      };
    }

    // Check for run details: .../run/:runId
    const runMatch = path.match(/\/run\/([^/]+)$/);
    if (runMatch) {
      const runId = decodeURIComponent(runMatch[1]);
      const runDetailsTab =
        (searchParams.get('tab') as RunDetailsTab) || 'logs';

      return {
        view: 'run-details',
        tab: 'runs',
        runId,
        runDetailsTab,
      };
    }

    // List view - check for tab param
    const tab = (searchParams.get('tab') as WorkflowTab) || 'runs';

    return {
      view: 'list',
      tab,
      runDetailsTab: 'logs',
    };
  }, [location.pathname, searchParams]);

  /**
   * Set the active tab in list view
   */
  const setTab = useCallback(
    (tab: WorkflowTab) => {
      const newParams = new URLSearchParams(searchParams);

      if (tab === 'runs') {
        // 'runs' is the default, remove from URL
        newParams.delete('tab');
      } else {
        newParams.set('tab', tab);
      }

      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  /**
   * Set the active tab in run details view
   */
  const setRunDetailsTab = useCallback(
    (tab: RunDetailsTab) => {
      const newParams = new URLSearchParams(searchParams);

      if (tab === 'logs') {
        // 'logs' is the default, remove from URL
        newParams.delete('tab');
      } else {
        newParams.set('tab', tab);
      }

      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  /**
   * Navigate to the list view
   */
  const navigateToList = useCallback(
    (tab?: WorkflowTab) => {
      if (tab && tab !== 'runs') {
        navigate(`.?tab=${tab}`);
      } else {
        navigate('.', { replace: true });
      }
    },
    [navigate],
  );

  /**
   * Navigate to the config edit page
   */
  const navigateToConfig = useCallback(() => {
    navigate('./config');
  }, [navigate]);

  /**
   * Navigate to run details page
   */
  const navigateToRunDetails = useCallback(
    (runId: string, tab?: RunDetailsTab) => {
      const encodedRunId = encodeURIComponent(runId);
      const query = tab && tab !== 'logs' ? `?tab=${tab}` : '';
      navigate(`./run/${encodedRunId}${query}`);
    },
    [navigate],
  );

  /**
   * Navigate back (uses browser history)
   */
  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return {
    state,
    setTab,
    setRunDetailsTab,
    navigateToList,
    navigateToConfig,
    navigateToRunDetails,
    goBack,
  };
}
