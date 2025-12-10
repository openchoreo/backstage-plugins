import { useCallback } from 'react';
import { Grid } from '@material-ui/core';
import { useEntity } from '@backstage/plugin-catalog-react';

import { useItemActionTracker, useNotification } from '../../hooks';
import {
  useEnvironmentActions,
  isAlreadyPromoted,
  useEnvironmentRouting,
} from './hooks';
import type { Environment } from './hooks';
import type { PendingAction } from './types';
import { NotificationBanner, SetupCard, EnvironmentCard } from './components';
import { useEnvironmentsContext } from './EnvironmentsContext';

/**
 * List view for the Environments page.
 * Displays Setup Card and Environment Cards in a grid layout.
 */
export const EnvironmentsList = () => {
  const { entity } = useEntity();

  const {
    environments,
    displayEnvironments,
    loading,
    refetch,
    isWorkloadEditorSupported,
    autoDeploy,
    autoDeployUpdating,
    onAutoDeployChange,
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

  // Notifications
  const notification = useNotification();

  // Action handlers
  const { handleRefreshEnvironment, handleSuspend } = useEnvironmentActions(
    entity,
    refetch,
    notification,
    refreshTracker,
  );

  // Create isAlreadyPromoted checker for an environment
  const createPromotionChecker = useCallback(
    (env: Environment) => (targetEnvName: string) =>
      isAlreadyPromoted(env, targetEnvName, displayEnvironments),
    [displayEnvironments],
  );

  // Handler for opening workload config
  const handleOpenWorkloadConfig = useCallback(() => {
    navigateToWorkloadConfig();
  }, [navigateToWorkloadConfig]);

  // Handler for opening overrides
  const handleOpenOverrides = useCallback(
    (env: Environment) => {
      navigateToOverrides(env.name);
    },
    [navigateToOverrides],
  );

  // Handler for opening release details
  const handleOpenReleaseDetails = useCallback(
    (env: Environment) => {
      navigateToReleaseDetails(env.name);
    },
    [navigateToReleaseDetails],
  );

  // Handler for promotion - navigates to overrides page with pending action
  const handlePromoteWithOverridesCheck = useCallback(
    async (sourceEnv: Environment, targetEnvName: string): Promise<void> => {
      const releaseName = sourceEnv.deployment.releaseName;
      if (!releaseName) {
        throw new Error('No release to promote');
      }

      const pendingAction: PendingAction = {
        type: 'promote',
        releaseName,
        sourceEnvironment: sourceEnv.name,
        targetEnvironment: targetEnvName,
      };

      navigateToOverrides(targetEnvName, pendingAction);
    },
    [navigateToOverrides],
  );

  return (
    <>
      <NotificationBanner notification={notification.notification} />

      <Grid container spacing={3}>
        {/* Setup Card */}
        <Grid item xs={12} md={3}>
          <SetupCard
            loading={loading}
            environmentsExist={environments.length > 0}
            isWorkloadEditorSupported={isWorkloadEditorSupported}
            onConfigureWorkload={handleOpenWorkloadConfig}
            autoDeploy={autoDeploy}
            onAutoDeployChange={onAutoDeployChange}
            autoDeployUpdating={autoDeployUpdating}
          />
        </Grid>

        {/* Environment Cards */}
        {displayEnvironments.map(env => (
          <Grid key={env.name} item xs={12} md={3}>
            <EnvironmentCard
              environmentName={env.name}
              resourceName={env.resourceName}
              bindingName={env.bindingName}
              hasComponentTypeOverrides={env.hasComponentTypeOverrides}
              deployment={env.deployment}
              endpoints={env.endpoints}
              promotionTargets={env.promotionTargets}
              isRefreshing={refreshTracker.isActive(env.name)}
              isAlreadyPromoted={createPromotionChecker(env)}
              actionTrackers={{ promotionTracker, suspendTracker }}
              onRefresh={() => handleRefreshEnvironment(env.name)}
              onOpenOverrides={() => handleOpenOverrides(env)}
              onOpenReleaseDetails={() => handleOpenReleaseDetails(env)}
              onPromote={targetName =>
                promotionTracker
                  .withTracking(targetName, () =>
                    handlePromoteWithOverridesCheck(env, targetName),
                  )
                  .catch(err =>
                    notification.showError(`Error promoting: ${err}`),
                  )
              }
              onSuspend={() =>
                suspendTracker
                  .withTracking(env.name, () => handleSuspend(env.name))
                  .catch(err =>
                    notification.showError(`Error suspending: ${err}`),
                  )
              }
            />
          </Grid>
        ))}
      </Grid>
    </>
  );
};
