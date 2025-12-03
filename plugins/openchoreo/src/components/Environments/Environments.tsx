import { useCallback, useState, useEffect } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Progress } from '@backstage/core-components';
import { Grid, Box } from '@material-ui/core';
import {
  discoveryApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';

import { useItemActionTracker, useNotification } from '../../hooks';
import {
  useEnvironmentData,
  useStaleEnvironments,
  useEnvironmentPolling,
  useEnvironmentActions,
  isAlreadyPromoted,
} from './hooks';
import { useAutoDeployUpdate } from './hooks/useAutoDeployUpdate';
import type { Environment } from './hooks';
import type { EnvironmentViewMode, PendingAction } from './types';
import { useEnvironmentsStyles } from './styles';
import { NotificationBanner, SetupCard, EnvironmentCard } from './components';
import { EnvironmentOverridesPage } from './EnvironmentOverridesPage';
import { ReleaseDetailsPage } from './ReleaseDetailsPage';
import { WorkloadConfigPage } from './Workload/WorkloadConfigPage';
import { deployRelease, promoteToEnvironment } from '../../api/environments';
import { getComponentDetails } from '../../api/runtimeLogs';

export const Environments = () => {
  // Initialize global styles (includes keyframe animation)
  useEnvironmentsStyles();

  const { entity } = useEntity();
  const discovery = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  // View state management
  const [viewMode, setViewMode] = useState<EnvironmentViewMode>({
    type: 'list',
  });

  // Data fetching
  const { environments, loading, refetch } = useEnvironmentData(entity);
  const { displayEnvironments, isPending } = useStaleEnvironments(environments);

  // Auto deploy state
  const [autoDeploy, setAutoDeploy] = useState<boolean | undefined>(undefined);
  const { updateAutoDeploy, isUpdating: autoDeployUpdating } =
    useAutoDeployUpdate(entity, discovery, identityApi);

  // Action trackers
  const refreshTracker = useItemActionTracker<string>();
  const promotionTracker = useItemActionTracker<string>();
  const suspendTracker = useItemActionTracker<string>();

  // Notifications
  const notification = useNotification();

  // Fetch component details to get autoDeploy value
  useEffect(() => {
    const fetchComponentData = async () => {
      try {
        const componentData = await getComponentDetails(
          entity,
          discovery,
          identityApi,
        );
        if (componentData && 'autoDeploy' in componentData) {
          setAutoDeploy((componentData as any).autoDeploy);
        }
      } catch (err) {
        // Silently fail - autoDeploy will remain undefined
      }
    };

    fetchComponentData();
  }, [entity, discovery, identityApi]);

  // Polling for pending deployments
  useEnvironmentPolling(isPending, refetch);

  // Action handlers
  const { handleRefreshEnvironment, handleSuspend } = useEnvironmentActions(
    entity,
    discovery,
    identityApi,
    refetch,
    notification,
    refreshTracker,
  );

  // Handler for auto deploy toggle change
  const handleAutoDeployChange = useCallback(
    async (newAutoDeploy: boolean) => {
      const success = await updateAutoDeploy(newAutoDeploy);
      if (success) {
        setAutoDeploy(newAutoDeploy);
        notification.showSuccess(
          `Auto deploy ${newAutoDeploy ? 'enabled' : 'disabled'} successfully`,
        );
      } else {
        notification.showError('Failed to update auto deploy setting');
      }
    },
    [updateAutoDeploy, notification],
  );

  // Check if workload editor is supported
  const isWorkloadEditorSupported =
    entity.metadata.tags?.find(
      tag => tag === 'webapplication' || tag === 'service',
    ) || entity.metadata.annotations?.['openchoreo.io/component'] !== undefined;

  // Create isAlreadyPromoted checker for an environment
  const createPromotionChecker = useCallback(
    (env: Environment) => (targetEnvName: string) =>
      isAlreadyPromoted(env, targetEnvName, displayEnvironments),
    [displayEnvironments],
  );

  // Navigation handlers
  const handleBack = useCallback(() => {
    setViewMode({ type: 'list' });
  }, []);

  const handleOpenWorkloadConfig = useCallback(() => {
    setViewMode({ type: 'workload-config' });
  }, []);

  const handleOpenOverrides = useCallback((env: Environment) => {
    setViewMode({ type: 'overrides', environment: env });
  }, []);

  const handleOpenReleaseDetails = useCallback((env: Environment) => {
    setViewMode({ type: 'release-details', environment: env });
  }, []);

  // Handler for Previous button in Overrides page (back to WorkloadConfig)
  const handleOverridesPrevious = useCallback(() => {
    setViewMode({ type: 'workload-config' });
  }, []);

  // Handler for WorkloadConfig → Overrides navigation
  const handleWorkloadNext = useCallback(
    (releaseName: string, targetEnvironment: string) => {
      // Find the target environment from environments list (not displayEnvironments)
      // because on first deploy, the environment might not be in displayEnvironments yet
      let targetEnv = environments.find(
        env => env.name.toLowerCase() === targetEnvironment.toLowerCase(),
      );

      // If not found in environments, create a minimal environment object
      if (!targetEnv) {
        targetEnv = {
          name: targetEnvironment,
          deployment: {},
          endpoints: [],
        };
      }

      // Create environment object with the release name
      const envWithRelease: Environment = {
        ...targetEnv,
        deployment: {
          ...targetEnv.deployment,
          releaseName,
        },
      };

      const pendingAction: PendingAction = {
        type: 'deploy',
        releaseName,
        targetEnvironment,
      };

      setViewMode({
        type: 'overrides',
        environment: envWithRelease,
        pendingAction,
      });
    },
    [environments],
  );

  // Handler for when overrides are saved with a pending action
  const handlePendingActionComplete = useCallback(
    async (pendingAction: PendingAction) => {
      try {
        if (pendingAction.type === 'deploy') {
          // Complete the deploy after overrides are saved
          await deployRelease(
            entity,
            discovery,
            identityApi,
            pendingAction.releaseName,
          );
          notification.showSuccess(
            `Successfully deployed to ${pendingAction.targetEnvironment}`,
          );
        } else if (pendingAction.type === 'promote') {
          // Complete the promote after overrides are saved
          await promoteToEnvironment(
            entity,
            discovery,
            identityApi,
            pendingAction.sourceEnvironment.toLowerCase(),
            pendingAction.targetEnvironment.toLowerCase(),
          );
          notification.showSuccess(
            `Successfully promoted to ${pendingAction.targetEnvironment}`,
          );
        }
        refetch();
        setViewMode({ type: 'list' });
      } catch (err: any) {
        notification.showError(
          err.message || `Failed to complete ${pendingAction.type}`,
        );
        setViewMode({ type: 'list' });
      }
    },
    [entity, discovery, identityApi, notification, refetch],
  );

  // Handler for promotion - always shows overrides page
  const handlePromoteWithOverridesCheck = useCallback(
    async (sourceEnv: Environment, targetEnvName: string): Promise<void> => {
      const releaseName = sourceEnv.deployment.releaseName;
      if (!releaseName) {
        throw new Error('No release to promote');
      }

      // Find target environment
      const targetEnv = displayEnvironments.find(
        env => env.name.toLowerCase() === targetEnvName.toLowerCase(),
      );

      if (!targetEnv) {
        throw new Error(`Target environment '${targetEnvName}' not found`);
      }

      // Create environment object with the release name for overrides page
      const envWithRelease: Environment = {
        ...targetEnv,
        deployment: {
          ...targetEnv.deployment,
          releaseName,
        },
      };

      const pendingAction: PendingAction = {
        type: 'promote',
        releaseName,
        sourceEnvironment: sourceEnv.name,
        targetEnvironment: targetEnvName,
      };

      // Always navigate to overrides page for promotion
      setViewMode({
        type: 'overrides',
        environment: envWithRelease,
        pendingAction,
      });
    },
    [displayEnvironments],
  );

  // Loading state
  if (loading && environments.length === 0) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <Progress />
      </Box>
    );
  }

  // Render based on view mode
  return (
    <>
      <NotificationBanner notification={notification.notification} />

      {/* List View */}
      {viewMode.type === 'list' && (
        <Grid container spacing={3}>
          {/* Setup Card */}
          <Grid item xs={12} md={3}>
            <SetupCard
              loading={loading}
              environmentsExist={environments.length > 0}
              isWorkloadEditorSupported={!!isWorkloadEditorSupported}
              onConfigureWorkload={handleOpenWorkloadConfig}
              autoDeploy={autoDeploy}
              onAutoDeployChange={handleAutoDeployChange}
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
      )}

      {/* Workload Config Page */}
      {viewMode.type === 'workload-config' && (
        <WorkloadConfigPage
          onBack={handleBack}
          onNext={handleWorkloadNext}
          lowestEnvironment={
            environments[0]?.name?.toLowerCase() || 'development'
          }
        />
      )}

      {/* Environment Overrides Page */}
      {viewMode.type === 'overrides' && (
        <EnvironmentOverridesPage
          environment={viewMode.environment}
          entity={entity}
          onBack={handleBack}
          onSaved={refetch}
          pendingAction={viewMode.pendingAction}
          onPendingActionComplete={handlePendingActionComplete}
          onPrevious={
            viewMode.pendingAction?.type === 'deploy'
              ? handleOverridesPrevious
              : undefined
          }
        />
      )}

      {/* Release Details Page */}
      {viewMode.type === 'release-details' && (
        <ReleaseDetailsPage
          environment={viewMode.environment}
          entity={entity}
          onBack={handleBack}
        />
      )}
    </>
  );
};
