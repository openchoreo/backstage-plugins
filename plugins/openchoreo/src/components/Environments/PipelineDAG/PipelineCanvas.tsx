import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { Box } from '@material-ui/core';
import { useEntity } from '@backstage/plugin-catalog-react';

import { useItemActionTracker, useNotification } from '../../../hooks';
import {
  useEnvironmentActions,
  isAlreadyPromoted as isAlreadyPromotedUtil,
  useEnvironmentRouting,
} from '../hooks';
import type { Environment } from '../hooks';
import type { PendingAction } from '../types';
import { EnvironmentDetailPanel, NotificationBanner } from '../components';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { useIncidentsSummary } from '../hooks/useIncidentsSummary';
import { isForbiddenError, getErrorMessage } from '../../../utils/errorUtils';
import { EmptyState, ForbiddenState } from '@openchoreo/backstage-plugin-react';
import { Card } from '@openchoreo/backstage-design-system';
import { useDeployFlowCanvasStyles } from '../styles';
import { DeployFlowCanvas } from './DeployFlowCanvas';

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

  // Selection state — survives refetch, auto-clears when a selected env
  // disappears. Setup is a first-class selection target so the right pane
  // can render Auto Deploy + Configure & Deploy when the user clicks the
  // Setup tile on the canvas.
  type Selection = { kind: 'env'; name: string } | { kind: 'setup' } | null;
  const [selection, setSelection] = useState<Selection>(null);

  const envMap = useMemo(() => {
    const map = new Map<string, Environment>();
    for (const env of displayEnvironments) map.set(env.name, env);
    return map;
  }, [displayEnvironments]);

  useEffect(() => {
    if (selection?.kind === 'env' && !envMap.has(selection.name)) {
      setSelection(null);
    }
  }, [selection, envMap]);

  const selectedEnvName = selection?.kind === 'env' ? selection.name : null;
  const selectedSetup = selection?.kind === 'setup';

  const hasAnyDeployedEnv = useMemo(
    () => displayEnvironments.some(env => !!env.bindingName),
    [displayEnvironments],
  );

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
  };

  const showSplitLayout = !!displayEnvironments.length;

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

      {/* Permission/empty states when no environments */}
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
      {!loading && environments.length === 0 && canViewEnvironments && (
        <Card style={{ minHeight: '300px', width: '100%' }}>
          <EmptyState
            title="No environments available"
            description="No deployment environments were found for this component."
            action={{ label: 'Retry', onClick: refetch }}
          />
        </Card>
      )}

      {showSplitLayout && (
        <Box className={classes.splitContainer}>
          <DeployFlowCanvas
            environments={displayEnvironments}
            loading={loading}
            isWorkloadEditorSupported={isWorkloadEditorSupported}
            selectedEnvName={selectedEnvName}
            selectedSetup={selectedSetup}
            refreshingEnvName={envName => refreshTracker.isActive(envName)}
            isAlreadyPromoted={isAlreadyPromoted}
            actionTrackers={actionTrackers}
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
            onSuspend={handleSuspend}
            onRedeploy={handleRedeployEnv}
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
            />
          </Box>
        </Box>
      )}
    </>
  );
};
