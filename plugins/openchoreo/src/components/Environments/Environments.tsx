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
import type { EnvironmentViewMode, PendingAction } from './types';
import { useEnvironmentsStyles } from './styles';
import { NotificationBanner, SetupCard, EnvironmentCard } from './components';
import { EnvironmentOverridesPage } from './EnvironmentOverridesPage';
import { ReleaseDetailsPage } from './ReleaseDetailsPage';
import { WorkloadConfigPage } from './Workload/WorkloadConfigPage';
import {
  deployRelease,
  promoteToEnvironment,
  fetchComponentReleaseSchema,
  fetchReleaseBindings,
  ReleaseBinding,
} from '../../api/environments';
import { getMissingRequiredFields } from './overridesUtils';
import { JSONSchema7 } from 'json-schema';

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

  // Handler for when required overrides are missing during deploy
  const handleRequiredOverridesMissing = useCallback(
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
            pendingAction.sourceEnvironment,
            pendingAction.targetEnvironment,
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

  // Check if required overrides are missing for a release/environment
  const checkRequiredOverrides = useCallback(
    async (releaseName: string, environmentName: string): Promise<string[]> => {
      try {
        // Fetch schema for the release
        const schemaResponse = await fetchComponentReleaseSchema(
          entity,
          discovery,
          identityApi,
          releaseName,
        );

        if (!schemaResponse.success || !schemaResponse.data) {
          return []; // No schema = no required fields
        }

        // Extract componentTypeEnvOverrides schema
        // The schema response can have different structures depending on the backend
        const schemaData = schemaResponse.data as Record<string, unknown>;

        // Try direct access first (componentTypeEnvOverrides at root)
        let componentTypeSchema = schemaData.componentTypeEnvOverrides as
          | JSONSchema7
          | undefined;

        // If not found, try nested under properties (for wrapped schema)
        if (!componentTypeSchema && schemaData.properties) {
          const propsData = schemaData.properties as Record<string, unknown>;
          componentTypeSchema = propsData.componentTypeEnvOverrides as
            | JSONSchema7
            | undefined;
        }

        // Check if there are actually required fields
        if (
          !componentTypeSchema?.required ||
          !Array.isArray(componentTypeSchema.required) ||
          componentTypeSchema.required.length === 0
        ) {
          return []; // No required fields
        }

        // Fetch existing bindings to check current values
        const bindingsResponse = await fetchReleaseBindings(
          entity,
          discovery,
          identityApi,
        );

        let currentOverrides: Record<string, unknown> = {};
        if (bindingsResponse.success && bindingsResponse.data?.items) {
          const bindings = bindingsResponse.data.items as ReleaseBinding[];
          const binding = bindings.find(
            b => b.environment.toLowerCase() === environmentName.toLowerCase(),
          );
          if (binding?.componentTypeEnvOverrides) {
            currentOverrides = binding.componentTypeEnvOverrides as Record<
              string,
              unknown
            >;
          }
        }

        return getMissingRequiredFields(componentTypeSchema, currentOverrides);
      } catch {
        // On error, don't block - allow action to proceed
        return [];
      }
    },
    [entity, discovery, identityApi],
  );

  // Handler for promotion with required overrides check
  const handlePromoteWithOverridesCheck = useCallback(
    async (sourceEnv: Environment, targetEnvName: string) => {
      const releaseName = sourceEnv.deployment.releaseName;
      if (!releaseName) {
        throw new Error('No release to promote');
      }

      // Check for required overrides in target environment
      const missingFields = await checkRequiredOverrides(
        releaseName,
        targetEnvName,
      );

      if (missingFields.length > 0) {
        // Find or create target environment object
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

        setViewMode({
          type: 'overrides',
          environment: envWithRelease,
          pendingAction,
        });
        return; // Exit - user will be redirected to overrides page
      }

      // No missing required fields - proceed with promotion
      await handlePromote(sourceEnv.name, targetEnvName);
    },
    [checkRequiredOverrides, displayEnvironments, handlePromote],
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
          onDeployed={refetchAsync}
          onRequiredOverridesMissing={handleRequiredOverridesMissing}
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
