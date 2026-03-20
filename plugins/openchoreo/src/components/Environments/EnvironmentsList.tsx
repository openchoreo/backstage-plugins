import { useCallback, useMemo } from 'react';
import { Grid } from '@material-ui/core';
import { useEntity } from '@backstage/plugin-catalog-react';

import { useEntityLinks } from '@openchoreo/backstage-plugin-react';
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
import { useIncidentsSummary } from './hooks/useIncidentsSummary';
import { isForbiddenError, getErrorMessage } from '../../utils/errorUtils';
import { EmptyState, ForbiddenState } from '@openchoreo/backstage-plugin-react';
import { Card } from '@openchoreo/backstage-design-system';

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
    canViewEnvironments,
    environmentReadPermissionLoading,
    canViewBindings,
    bindingsPermissionLoading,
  } = useEnvironmentsContext();

  const {
    navigateToWorkloadConfig,
    navigateToOverrides,
    navigateToReleaseDetails,
  } = useEnvironmentRouting();

  const links = useEntityLinks(entity);

  // Action trackers
  const refreshTracker = useItemActionTracker<string>();
  const promotionTracker = useItemActionTracker<string>();
  const suspendTracker = useItemActionTracker<string>();

  // Incidents summary per environment
  const deployedEnvironments = useMemo(
    () => displayEnvironments.filter(env => env.deployment.status === 'Ready'),
    [displayEnvironments],
  );
  const incidentsSummaries = useIncidentsSummary(deployedEnvironments);

  // Notifications
  const notification = useNotification();

  // Action handlers
  const { handleRefreshEnvironment, handleUndeploy, handleRedeploy } =
    useEnvironmentActions(entity, refetch, notification, refreshTracker);

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
        sourceEnvironment: sourceEnv.resourceName ?? sourceEnv.name,
        targetEnvironment: targetEnvName,
      };

      navigateToOverrides(targetEnvName, pendingAction);
    },
    [navigateToOverrides],
  );

  return (
    <>
      <NotificationBanner notification={notification.notification} />

      <Grid container spacing={3} alignItems="stretch">
        {/* Setup Card */}
        <Grid item xs={12} md={3} style={{ display: 'flex' }}>
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

        {/* No environments: show forbidden or empty state as a card */}
        {!loading &&
          !environmentReadPermissionLoading &&
          environments.length === 0 &&
          !canViewEnvironments && (
            <Grid item xs={12} md={3} style={{ display: 'flex' }}>
              <Card
                style={{ height: '100%', minHeight: '300px', width: '100%' }}
              >
                <ForbiddenState
                  message="You do not have permission to view deployment environments."
                  onRetry={refetch}
                />
              </Card>
            </Grid>
          )}
        {!loading && environments.length === 0 && canViewEnvironments && (
          <Grid item xs={12} md={3} style={{ display: 'flex' }}>
            <Card style={{ height: '100%', minHeight: '300px', width: '100%' }}>
              <EmptyState
                title="No environments available"
                description="No deployment environments were found for this component."
                action={{ label: 'Retry', onClick: refetch }}
              />
            </Card>
          </Grid>
        )}

        {/* Environment Cards */}
        {displayEnvironments.map(env => (
          <Grid key={env.name} item xs={12} md={3} style={{ display: 'flex' }}>
            <EnvironmentCard
              environmentName={env.name}
              resourceName={env.resourceName}
              bindingName={env.bindingName}
              hasComponentTypeOverrides={env.hasComponentTypeOverrides}
              canViewBindings={canViewBindings}
              bindingsPermissionLoading={bindingsPermissionLoading}
              dataPlaneRef={env.dataPlaneRef}
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
                    notification.showError(
                      isForbiddenError(err)
                        ? 'You do not have permission to promote. Contact your administrator.'
                        : `Error promoting: ${getErrorMessage(err)}`,
                    ),
                  )
              }
              onSuspend={() =>
                suspendTracker
                  .withTracking(env.name, () =>
                    handleUndeploy(
                      env.bindingName ?? `${env.resourceName ?? env.name}`,
                    ),
                  )
                  .catch(err =>
                    notification.showError(
                      isForbiddenError(err)
                        ? 'You do not have permission to undeploy. Contact your administrator.'
                        : `Error undeploying: ${getErrorMessage(err)}`,
                    ),
                  )
              }
              onRedeploy={() =>
                suspendTracker
                  .withTracking(env.name, () =>
                    handleRedeploy(
                      env.bindingName ?? `${env.resourceName ?? env.name}`,
                    ),
                  )
                  .catch(err =>
                    notification.showError(
                      isForbiddenError(err)
                        ? 'You do not have permission to redeploy. Contact your administrator.'
                        : `Error redeploying: ${getErrorMessage(err)}`,
                    ),
                  )
              }
              activeIncidentCount={
                incidentsSummaries.get(env.name)?.activeCount
              }
              logsUrl={links.runtimeLogs(env.name)}
            />
          </Grid>
        ))}
      </Grid>
    </>
  );
};
