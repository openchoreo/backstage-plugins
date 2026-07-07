import { useCallback, useEffect, useMemo, useRef, type FC } from 'react';
import { Box } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import { EmptyState } from '@backstage/core-components';

import { useItemActionTracker, useNotification } from '../../../hooks';
import {
  useEnvironmentActions,
  isAlreadyPromoted as isAlreadyPromotedUtil,
  useEnvironmentRouting,
  computeReleaseDrift,
  getEnvironmentStatusVariant,
  NO_DRIFT,
} from '../hooks';
import type { Environment, ReleaseDriftInfo } from '../hooks';
import type { PendingAction } from '../types';
import { EnvironmentDetailPanel, NotificationBanner } from '../components';
import { useEnvironmentsContext, type Selection } from '../EnvironmentsContext';
import { useIncidentsSummary } from '../hooks/useIncidentsSummary';
import { isForbiddenError, getErrorMessage } from '../../../utils/errorUtils';
import { ForbiddenState } from '@openchoreo/backstage-plugin-react';
import { Card, useChoreoTokens } from '@openchoreo/backstage-design-system';
import {
  useDeployFlowCanvasStyles,
  useEnvironmentDetailPanelStyles,
} from '../styles';
import { DeployFlowCanvas } from './DeployFlowCanvas';
import { NoEnvironmentsEmptyState } from '../components/NoEnvironmentsEmptyState';

/** Placeholder canvas tiles while initial env data loads. */
const CanvasSkeleton: FC = () => {
  const classes = useDeployFlowCanvasStyles();
  return (
    <Box className={classes.skeletonCanvasInner} data-testid="canvas-skeleton">
      {[0, 1, 2, 3].map(i => (
        <Skeleton
          key={i}
          variant="rect"
          width={160}
          height={80}
          style={{ borderRadius: 8 }}
        />
      ))}
    </Box>
  );
};

/** Placeholder right-pane chrome while initial env data loads. */
const DetailPanelSkeleton: FC = () => {
  const classes = useEnvironmentDetailPanelStyles();
  return (
    <Box className={classes.panel} data-testid="detail-panel-skeleton">
      <Box className={classes.header}>
        <Box className={classes.headerTopRow}>
          <Skeleton
            variant="rect"
            width={64}
            height={24}
            style={{ borderRadius: 12 }}
          />
          <Box display="flex" style={{ gap: 8 }}>
            <Skeleton variant="circle" width={28} height={28} />
            <Skeleton variant="circle" width={28} height={28} />
          </Box>
        </Box>
        <Skeleton variant="text" width="60%" height={28} />
      </Box>
      <Box className={classes.body} style={{ padding: 20 }}>
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="80%" />
        <Skeleton
          variant="rect"
          width="100%"
          height={36}
          style={{ marginTop: 12, borderRadius: 4 }}
        />
        <Skeleton variant="text" width="50%" style={{ marginTop: 24 }} />
        <Skeleton
          variant="rect"
          width="100%"
          height={28}
          style={{ marginTop: 8 }}
        />
      </Box>
    </Box>
  );
};

/**
 * Picks the card to select by default when the user hasn't chosen one.
 * Priority: first env with an active (or pending) deployment → first failed
 * → first undeployed (was deployed, torn down). If only never-deployed envs
 * remain, fall back to the Setup card. Uses the same classifier as the cards
 * so selection can't drift from what's displayed.
 */
function resolveDefaultSelection(envs: Environment[]): Selection {
  if (envs.length === 0) return null;

  const variantOf = (e: Environment) =>
    getEnvironmentStatusVariant(e.deployment.status, e.deployment.statusReason)
      .variant;

  const active = envs.find(e => {
    const v = variantOf(e);
    return v === 'active' || v === 'pending';
  });
  if (active) return { kind: 'env', name: active.name };

  const failed = envs.find(e => variantOf(e) === 'failed');
  if (failed) return { kind: 'env', name: failed.name };

  const undeployed = envs.find(e => variantOf(e) === 'undeployed');
  if (undeployed) return { kind: 'env', name: undeployed.name };

  // Only never-deployed envs remain — point the user at Setup.
  return { kind: 'setup' };
}

/**
 * Deploy tab orchestrator. Owns selection state and wires action
 * callbacks; renders the minimap canvas (left) + detail panel (right)
 * once at least one environment is loaded.
 */
export const PipelineCanvas: FC = () => {
  const classes = useDeployFlowCanvasStyles();
  const { entity } = useEntity();

  const {
    environments,
    displayEnvironments,
    loading,
    error,
    isRefetching,
    refetch,
    isWorkloadEditorSupported,
    canViewEnvironments,
    environmentReadPermissionLoading,
  } = useEnvironmentsContext();

  const {
    navigateToWorkloadConfig,
    navigateToOverrides,
    navigateToReleaseDetails,
  } = useEnvironmentRouting();

  // Action trackers
  const refreshTracker = useItemActionTracker<string>();
  const promotionTracker = useItemActionTracker<string>();
  const suspendTracker = useItemActionTracker<string>();
  const rolloutRestartTracker = useItemActionTracker<string>();
  const removeDeploymentTracker = useItemActionTracker<string>();

  // Selection lives on the EnvironmentsContext (lifted from local state)
  // so it survives navigation to/from intermediate pages
  // (workload-config / overrides / release-details). Auto-clear effect
  // here drops the selection when the selected env disappears from the
  // refetched list.
  const { selection, setSelection } = useEnvironmentsContext();

  const envMap = useMemo(() => {
    const map = new Map<string, Environment>();
    for (const env of displayEnvironments) map.set(env.name, env);
    return map;
  }, [displayEnvironments]);

  // One-shot guard so the default-selection effect below doesn't override a
  // user's explicit Close/Clear (both of which set selection back to null).
  const didAutoSelectRef = useRef(false);

  useEffect(() => {
    if (selection?.kind === 'env' && !envMap.has(selection.name)) {
      setSelection(null);
      // The selected env vanished — allow a fresh default to be picked.
      didAutoSelectRef.current = false;
    }
  }, [selection, envMap, setSelection]);

  // Auto-select a sensible default card once data has loaded, so users don't
  // land on an empty detail panel. Runs only once after the initial load (or
  // again after the selected env disappears, via the ref reset above), so it
  // never overrides a manual Close/Clear back to an empty panel.
  useEffect(() => {
    if (didAutoSelectRef.current) return;
    if (selection !== null) return;
    if (loading) return;
    if (displayEnvironments.length === 0) return;

    didAutoSelectRef.current = true;
    setSelection(resolveDefaultSelection(displayEnvironments));
  }, [selection, loading, displayEnvironments, setSelection]);

  const selectedEnvName = selection?.kind === 'env' ? selection.name : null;
  const selectedSetup = selection?.kind === 'setup';

  const hasAnyDeployedEnv = useMemo(
    () => displayEnvironments.some(env => !!env.bindingName),
    [displayEnvironments],
  );

  const driftByEnv = useMemo(() => {
    const map = new Map<string, ReleaseDriftInfo>();
    for (const env of displayEnvironments) {
      map.set(env.name, computeReleaseDrift(env, displayEnvironments));
    }
    return map;
  }, [displayEnvironments]);

  // Incidents summary per environment
  const deployedEnvironments = useMemo(
    () => displayEnvironments.filter(env => env.deployment.status === 'Ready'),
    [displayEnvironments],
  );
  const incidentsSummaries = useIncidentsSummary(deployedEnvironments);

  // Notifications
  const notification = useNotification();

  // Action handlers
  const {
    handleRefreshEnvironment,
    handleUndeploy,
    handleRedeploy,
    handleRolloutRestart,
    handleRemoveDeployment,
  } = useEnvironmentActions(entity, refetch, notification, refreshTracker);

  const handleOpenWorkloadConfig = useCallback(() => {
    navigateToWorkloadConfig();
  }, [navigateToWorkloadConfig]);

  const handleOpenOverrides = useCallback(
    (env: Environment) => {
      navigateToOverrides(env.name);
    },
    [navigateToOverrides],
  );

  const handleOpenReleaseDetails = useCallback(
    (env: Environment) => {
      navigateToReleaseDetails(env.name);
    },
    [navigateToReleaseDetails],
  );

  const handlePromoteWithOverridesCheck = useCallback(
    async (sourceEnv: Environment, targetEnvName: string): Promise<void> => {
      const releaseName = sourceEnv.deployment.releaseName;
      if (!releaseName) {
        throw new Error('No release to promote');
      }
      const pendingAction: PendingAction = {
        type: 'promote',
        releaseName,
        sourceEnvironment: sourceEnv.resourceName ?? sourceEnv.name,
        targetEnvironment: targetEnvName,
      };
      navigateToOverrides(targetEnvName, pendingAction);
    },
    [navigateToOverrides],
  );

  const handlePromote = useCallback(
    async (env: Environment, targetEnvName: string) => {
      try {
        await promotionTracker.withTracking(targetEnvName, () =>
          handlePromoteWithOverridesCheck(env, targetEnvName),
        );
      } catch (err) {
        notification.showError(
          isForbiddenError(err)
            ? 'You do not have permission to promote. Contact your administrator.'
            : `Error promoting: ${getErrorMessage(err)}`,
        );
      }
    },
    [handlePromoteWithOverridesCheck, promotionTracker, notification],
  );

  const handleSuspend = useCallback(
    async (env: Environment) => {
      try {
        await suspendTracker.withTracking(env.name, () =>
          handleUndeploy(env.bindingName ?? `${env.resourceName ?? env.name}`),
        );
      } catch (err) {
        notification.showError(
          isForbiddenError(err)
            ? 'You do not have permission to undeploy. Contact your administrator.'
            : `Error undeploying: ${getErrorMessage(err)}`,
        );
      }
    },
    [handleUndeploy, suspendTracker, notification],
  );

  const handleRedeployEnv = useCallback(
    async (env: Environment) => {
      try {
        await suspendTracker.withTracking(env.name, () =>
          handleRedeploy(env.bindingName ?? `${env.resourceName ?? env.name}`),
        );
      } catch (err) {
        notification.showError(
          isForbiddenError(err)
            ? 'You do not have permission to redeploy. Contact your administrator.'
            : `Error redeploying: ${getErrorMessage(err)}`,
        );
      }
    },
    [handleRedeploy, suspendTracker, notification],
  );

  const handleRolloutRestartEnv = useCallback(
    async (env: Environment) => {
      const targetId = env.bindingName ?? `${env.resourceName ?? env.name}`;
      try {
        await rolloutRestartTracker.withTracking(targetId, () =>
          handleRolloutRestart(targetId),
        );
      } catch (err) {
        notification.showError(
          isForbiddenError(err)
            ? 'You do not have permission to restart rollouts. Contact your administrator.'
            : `Error restarting rollout: ${getErrorMessage(err)}`,
        );
      }
    },
    [handleRolloutRestart, rolloutRestartTracker, notification],
  );

  const handleRemoveDeploymentEnv = useCallback(
    async (env: Environment) => {
      const targetId = env.bindingName ?? `${env.resourceName ?? env.name}`;
      try {
        await removeDeploymentTracker.withTracking(targetId, () =>
          handleRemoveDeployment(targetId, env.resourceName ?? env.name),
        );
      } catch (err) {
        notification.showError(
          isForbiddenError(err)
            ? 'You do not have permission to remove deployments. Contact your administrator.'
            : `Error removing deployment: ${getErrorMessage(err)}`,
        );
      }
    },
    [handleRemoveDeployment, removeDeploymentTracker, notification],
  );

  const isAlreadyPromoted = useCallback(
    (env: Environment, target: string) =>
      isAlreadyPromotedUtil(env, target, displayEnvironments),
    [displayEnvironments],
  );

  const selectedEnv =
    selectedEnvName !== null ? envMap.get(selectedEnvName) ?? null : null;

  const actionTrackers = {
    promotionTracker,
    suspendTracker,
    rolloutRestartTracker,
    removeDeploymentTracker,
  };

  const showSplitLayout = !!displayEnvironments.length;
  // Show skeletons when we have nothing to render yet but expect data
  // soon — i.e. an initial fetch / permission check is still in flight
  // and we haven't already failed the forbidden-state gate.
  const showSkeleton =
    !showSplitLayout &&
    environments.length === 0 &&
    (loading || environmentReadPermissionLoading) &&
    canViewEnvironments !== false;
  const tokens = useChoreoTokens();

  let panelSelection:
    | { kind: 'env'; environment: Environment }
    | { kind: 'setup' }
    | null = null;
  if (selectedEnv) {
    panelSelection = { kind: 'env', environment: selectedEnv };
  } else if (selectedSetup) {
    panelSelection = { kind: 'setup' };
  }

  return (
    <>
      <NotificationBanner notification={notification.notification} />

      {/* Permission/error/empty states when no environments */}
      {!loading &&
        !environmentReadPermissionLoading &&
        environments.length === 0 &&
        !canViewEnvironments && (
          <Card style={{ minHeight: '300px', width: '100%' }}>
            <ForbiddenState
              message="You do not have permission to view deployment environments."
              onRetry={refetch}
            />
          </Card>
        )}
      {!loading &&
        !environmentReadPermissionLoading &&
        environments.length === 0 &&
        canViewEnvironments &&
        error && (
          <EmptyState
            missing="data"
            title="Failed to load environments"
            description={getErrorMessage(error)}
          />
        )}
      {!loading &&
        !environmentReadPermissionLoading &&
        !error &&
        environments.length === 0 &&
        canViewEnvironments && <NoEnvironmentsEmptyState />}

      {showSkeleton && (
        <Box className={classes.splitContainer}>
          <Box
            className={classes.canvasFrame}
            style={{
              ['--canvas-dots' as string]: tokens.graph.canvasDotPattern,
            }}
          >
            <CanvasSkeleton />
          </Box>
          <Box className={classes.detailPanelFrame}>
            <DetailPanelSkeleton />
          </Box>
        </Box>
      )}

      {showSplitLayout && (
        <Box className={classes.splitContainer}>
          <DeployFlowCanvas
            environments={displayEnvironments}
            loading={loading}
            isRefetching={isRefetching}
            isWorkloadEditorSupported={isWorkloadEditorSupported}
            selectedEnvName={selectedEnvName}
            selectedSetup={selectedSetup}
            refreshingEnvName={envName => refreshTracker.isActive(envName)}
            isAlreadyPromoted={isAlreadyPromoted}
            actionTrackers={actionTrackers}
            incidentsSummaries={incidentsSummaries}
            onSelectEnv={name =>
              setSelection(name ? { kind: 'env', name } : null)
            }
            onSelectSetup={() => setSelection({ kind: 'setup' })}
            onClearSelection={() => setSelection(null)}
            onConfigureWorkload={handleOpenWorkloadConfig}
            onRefreshEnv={handleRefreshEnvironment}
            onOpenOverrides={handleOpenOverrides}
            onOpenReleaseDetails={handleOpenReleaseDetails}
            onPromote={handlePromote}
          />
          <Box className={classes.detailPanelFrame}>
            <EnvironmentDetailPanel
              selection={panelSelection}
              isAlreadyPromoted={target =>
                selectedEnv ? isAlreadyPromoted(selectedEnv, target) : false
              }
              actionTrackers={actionTrackers}
              activeIncidentCount={
                selectedEnv
                  ? incidentsSummaries.get(selectedEnv.name)?.activeCount
                  : undefined
              }
              hasAnyDeployedEnv={hasAnyDeployedEnv}
              driftInfo={
                selectedEnv
                  ? driftByEnv.get(selectedEnv.name) ?? NO_DRIFT
                  : NO_DRIFT
              }
              isWorkloadEditorSupported={isWorkloadEditorSupported}
              environmentsExist={displayEnvironments.length > 0}
              loadingSetup={loading}
              onConfigureWorkload={handleOpenWorkloadConfig}
              onClose={() => setSelection(null)}
              onRefresh={() =>
                selectedEnv && handleRefreshEnvironment(selectedEnv.name)
              }
              onOpenOverrides={() =>
                selectedEnv && handleOpenOverrides(selectedEnv)
              }
              onOpenReleaseDetails={() =>
                selectedEnv && handleOpenReleaseDetails(selectedEnv)
              }
              onPromote={async target => {
                if (!selectedEnv) return;
                await handlePromote(selectedEnv, target);
              }}
              onSuspend={async () => {
                if (!selectedEnv) return;
                await handleSuspend(selectedEnv);
              }}
              onRedeploy={async () => {
                if (!selectedEnv) return;
                await handleRedeployEnv(selectedEnv);
              }}
              onRolloutRestart={async () => {
                if (!selectedEnv) return;
                await handleRolloutRestartEnv(selectedEnv);
              }}
              onRemoveDeployment={async () => {
                if (!selectedEnv) return;
                await handleRemoveDeploymentEnv(selectedEnv);
              }}
            />
          </Box>
        </Box>
      )}
    </>
  );
};
