import { createContext, useContext, ReactNode } from 'react';
import type { Environment } from './hooks/useEnvironmentData';
import type { ComponentError } from './hooks/useAutoDeploy';
import type { PendingAction } from './types';

/**
 * Canvas selection target. Lives on the context so selection survives
 * navigation between the deploy list view and intermediate pages
 * (workload-config, overrides, release-details). `null` = nothing
 * selected.
 */
export type Selection =
  | { kind: 'env'; name: string }
  | { kind: 'setup' }
  | null;

/**
 * Scope handed to the host-app-supplied "investigate" slot when a
 * deployment is in a problem state. Mirrors the render-prop pattern used
 * for runtime-log debugging (``RenderLogRowAction`` in the observability
 * plugin): this plugin owns the shape and decides *where* the affordance
 * renders, while ``packages/app`` injects the actual assistant button —
 * so the openchoreo plugin keeps no dependency on portal-assistant.
 */
export interface InvestigateScope {
  /** Control-plane namespace of the component. */
  namespace?: string;
  /** Project the component belongs to. */
  project?: string;
  /** The component whose deployment is in trouble. */
  component: string;
  /** Environment resource name the binding is in. */
  environment?: string;
  /**
   * Which assistant flow to launch: ``dependency_pending`` when the cause
   * is an unresolved connection, otherwise ``runtime_debug``.
   */
  caseType: 'dependency_pending' | 'runtime_debug';
  /** Human-readable deployment status, e.g. ``Pending`` / ``Failed``. */
  status: string;
}

/** Render-prop slot for the deploy-panel investigate affordance. */
export type RenderInvestigateAction = (scope: InvestigateScope) => ReactNode;

interface EnvironmentsContextValue {
  /** All environments loaded from the API */
  environments: Environment[];
  /** Environments with stale data handling */
  displayEnvironments: Environment[];
  /** Whether environments are currently loading */
  loading: boolean;
  /**
   * A non-forbidden error from the environment fetch (e.g. the deployment
   * pipeline could not be resolved).
   */
  error?: Error;
  /** Refetch environments data */
  refetch: () => void;
  /** The lowest environment (first in deployment pipeline) */
  lowestEnvironment: string;
  /** Whether workload editor is supported for this component */
  isWorkloadEditorSupported: boolean;
  /** Handler for completing a pending action (deploy/promote) */
  onPendingActionComplete: (action: PendingAction) => Promise<void>;
  /** Whether the user has permission to view environments */
  canViewEnvironments: boolean;
  /** Whether the environment read permission check is still loading */
  environmentReadPermissionLoading: boolean;
  /** Whether the user has permission to view release bindings */
  canViewBindings: boolean;
  /** Whether the release binding permission check is still loading */
  bindingsPermissionLoading: boolean;
  /** Component-level auto-deploy flag (shared across SetupDetailPane and WorkloadConfigPage). */
  autoDeploy: boolean;
  /** Whether the auto-deploy value is still being fetched. */
  autoDeployLoading: boolean;
  /** Re-read the auto-deploy value from the server (e.g. after toggling it). */
  refetchAutoDeploy: () => void;
  /**
   * Optimistic setter for the auto-deploy flag. The Setup card toggle
   * calls this on Confirm so the switch flips instantly; the PATCH runs
   * in the background and we snap back on failure. No refetch is
   * triggered (and so no card-wide skeleton).
   */
  setAutoDeployOptimistic: (next: boolean) => void;
  /**
   * Controller-managed pointer to the latest ComponentRelease, mirrored
   * from `Component.status.latestRelease.name`. Used by the Setup card
   * auto-deploy ON row instead of picking newest-by-creation-timestamp
   * (which would pick up orphan releases).
   */
  latestReleaseName: string | null;
  /**
   * Controller error from `Component.status.conditions` (Ready=False with an
   * error reason), or null when healthy. This is the only carrier for
   * pre-binding auto-deploy failures (bad trait, invalid config) — they never
   * produce a ReleaseBinding, so there is no per-env status to read. Surfaced
   * on the Setup card and attributed to the first env in the deploy detail.
   */
  componentError: ComponentError | null;
  /**
   * True while we're polling the controller after a UI-driven auto-deploy
   * save. Drives the "Deploying…" pill on the Setup card.
   */
  awaitingNewRelease: boolean;
  /**
   * Call right after a UI-driven save to start the post-save poll. The
   * hook captures the current latestReleaseName as the baseline; once
   * the controller updates status to a different name, the pill clears.
   */
  beginAwaitingNewRelease: () => void;
  /** Currently selected canvas tile (env or setup). Null = nothing selected. */
  selection: Selection;
  /** Setter for the canvas selection. */
  setSelection: (next: Selection) => void;
  /**
   * Optional host-app slot rendered next to the status badge when a
   * deployment is pending/failed. Supplied by ``packages/app`` so the
   * plugin stays free of any portal-assistant coupling. Undefined → no
   * button is shown.
   */
  renderInvestigateAction?: RenderInvestigateAction;
}

const EnvironmentsContext = createContext<EnvironmentsContextValue | null>(
  null,
);

interface EnvironmentsProviderProps {
  children: ReactNode;
  value: EnvironmentsContextValue;
}

export const EnvironmentsProvider = ({
  children,
  value,
}: EnvironmentsProviderProps) => {
  return (
    <EnvironmentsContext.Provider value={value}>
      {children}
    </EnvironmentsContext.Provider>
  );
};

export function useEnvironmentsContext() {
  const context = useContext(EnvironmentsContext);
  if (!context) {
    throw new Error(
      'useEnvironmentsContext must be used within an EnvironmentsProvider',
    );
  }
  return context;
}
