import { useCallback } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Content, Page } from '@backstage/core-components';
import { Grid, Box, Typography } from '@material-ui/core';
import {
  discoveryApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';

import {
  useDialogWithSelection,
  useItemActionTracker,
  useNotification,
} from '../../hooks';
import {
  useEnvironmentData,
  useStaleEnvironments,
  useEnvironmentPolling,
  useEnvironmentActions,
  isAlreadyPromoted,
} from './hooks';
import type { Environment } from './hooks';
import { useEnvironmentsStyles } from './styles';
import { NotificationBanner, SetupCard, EnvironmentCard } from './components';
import { EnvironmentOverridesDialog } from './EnvironmentOverridesDialog';
import { ReleaseDetailsDialog } from './ReleaseDetailsDialog';

export const Environments = () => {
  // Initialize global styles (includes keyframe animation)
  useEnvironmentsStyles();

  const { entity } = useEntity();
  const discovery = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  // Data fetching
  const { environments, loading, refetch } = useEnvironmentData(entity);
  const { displayEnvironments, isPending } = useStaleEnvironments(environments);

  // Action trackers
  const refreshTracker = useItemActionTracker<string>();
  const promotionTracker = useItemActionTracker<string>();
  const suspendTracker = useItemActionTracker<string>();

  // Notifications
  const notification = useNotification();

  // Dialog state
  const overridesDialog = useDialogWithSelection<Environment>();
  const releaseDialog = useDialogWithSelection<Environment>();

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

  // Loading state
  if (loading && environments.length === 0) {
    return (
      <Page themeId="tool">
        <Content>
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="400px"
          >
            <Typography variant="h6">Loading environments...</Typography>
          </Box>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Content>
        <NotificationBanner notification={notification.notification} />

        <Grid container spacing={3}>
          {/* Setup Card */}
          <Grid item xs={12} md={3}>
            <SetupCard
              loading={loading}
              environmentsExist={environments.length > 0}
              isWorkloadEditorSupported={!!isWorkloadEditorSupported}
              onDeployed={refetchAsync}
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
                onOpenOverrides={() => overridesDialog.open(env)}
                onOpenReleaseDetails={() => releaseDialog.open(env)}
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

        {/* Dialogs */}
        <EnvironmentOverridesDialog
          open={overridesDialog.isOpen}
          onClose={overridesDialog.close}
          environment={overridesDialog.selected}
          entity={entity}
          onSaved={refetch}
        />

        <ReleaseDetailsDialog
          open={releaseDialog.isOpen}
          onClose={releaseDialog.close}
          environmentName={
            releaseDialog.selected?.resourceName ||
            releaseDialog.selected?.name ||
            ''
          }
          environmentDisplayName={releaseDialog.selected?.name}
          entity={entity}
        />
      </Content>
    </Page>
  );
};
