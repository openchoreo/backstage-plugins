import { useCallback, useState } from 'react';
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
import type { Environment } from './hooks';
import type { EnvironmentViewMode } from './types';
import { useEnvironmentsStyles } from './styles';
import { NotificationBanner, SetupCard, EnvironmentCard } from './components';
import { EnvironmentOverridesPage } from './EnvironmentOverridesPage';
import { ReleaseDetailsPage } from './ReleaseDetailsPage';
import { WorkloadConfigPage } from './Workload/WorkloadConfigPage';

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

  // Action trackers
  const refreshTracker = useItemActionTracker<string>();
  const promotionTracker = useItemActionTracker<string>();
  const suspendTracker = useItemActionTracker<string>();

  // Notifications
  const notification = useNotification();

  // Polling for pending deployments
  useEnvironmentPolling(isPending, refetch);

  // Action handlers
  const { handleRefreshEnvironment, handlePromote, handleSuspend } =
    useEnvironmentActions(
      entity,
      discovery,
      identityApi,
      refetch,
      notification,
      refreshTracker,
    );

  // Check if workload editor is supported
  const isWorkloadEditorSupported =
    entity.metadata.tags?.find(
      tag => tag === 'webapplication' || tag === 'service',
    ) || entity.metadata.annotations?.['openchoreo.io/component'] !== undefined;

  // Wrapper to convert refetch to async for Workload component
  const refetchAsync = useCallback(async () => {
    refetch();
  }, [refetch]);

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
                      handlePromote(env.name, targetName),
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
        <WorkloadConfigPage onBack={handleBack} onDeployed={refetchAsync} />
      )}

      {/* Environment Overrides Page */}
      {viewMode.type === 'overrides' && (
        <EnvironmentOverridesPage
          environment={viewMode.environment}
          entity={entity}
          onBack={handleBack}
          onSaved={refetch}
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
