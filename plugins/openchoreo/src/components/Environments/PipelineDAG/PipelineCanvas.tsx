import { useMemo, useCallback, type FC } from 'react';
import { Box, useMediaQuery, useTheme } from '@material-ui/core';
import { useEntity } from '@backstage/plugin-catalog-react';

import { useItemActionTracker, useNotification } from '../../../hooks';
import {
  useEnvironmentActions,
  isAlreadyPromoted,
  useEnvironmentRouting,
} from '../hooks';
import type { Environment } from '../hooks';
import type { PendingAction } from '../types';
import { NotificationBanner, SetupCard, EnvironmentCard } from '../components';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { useIncidentsSummary } from '../hooks/useIncidentsSummary';
import { isForbiddenError, getErrorMessage } from '../../../utils/errorUtils';
import { EmptyState, ForbiddenState } from '@openchoreo/backstage-plugin-react';
import { Card } from '@openchoreo/backstage-design-system';

import { buildPipelineNodes, computePipelineLayout } from './pipelineLayoutUtils';
import { PipelineEdge } from './PipelineEdge';
import { usePipelineStyles } from './pipelineStyles';

const SETUP_NODE_ID = '__setup__';
const CANVAS_PADDING = 40;

/**
 * Pipeline DAG visualization for the Environments page.
 * Renders environment cards as positioned nodes in a dagre-computed DAG layout
 * with L-shaped CSS connectors showing promotion flow.
 */
export const PipelineCanvas: FC = () => {
  const classes = usePipelineStyles();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const { entity } = useEntity();

  const {
    environments,
    displayEnvironments,
    loading,
    refetch,
    isWorkloadEditorSupported,
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

  // Compute DAG layout
  const direction = isNarrow ? 'TB' : 'LR';
  const layout = useMemo(() => {
    if (displayEnvironments.length === 0) {
      return null;
    }
    const nodes = buildPipelineNodes(displayEnvironments);
    return computePipelineLayout(nodes, displayEnvironments, direction);
  }, [displayEnvironments, direction]);

  // Separate setup and environment nodes from layout
  const setupNode = layout?.nodes.find(n => n.id === SETUP_NODE_ID);
  const envNodes = layout?.nodes.filter(n => !n.isSetup) ?? [];

  // Build env lookup for easy access
  const envMap = useMemo(() => {
    const map = new Map<string, Environment>();
    for (const env of displayEnvironments) {
      map.set(env.name, env);
    }
    return map;
  }, [displayEnvironments]);

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

      {/* Pipeline DAG */}
      {layout && (
        <Box className={classes.pipelineContainer}>
          <div className={classes.scrollArea}>
            <div
              className={classes.canvas}
              style={{
                width: layout.width + CANVAS_PADDING,
                height: layout.height + CANVAS_PADDING,
              }}
            >
              {/* Edges (rendered first, behind nodes) */}
              {layout.edges.map(edge => (
                <PipelineEdge
                  key={`${edge.from}-${edge.to}`}
                  edge={edge}
                />
              ))}

              {/* Setup node - vertically centered within its allocated space */}
              {setupNode && (
                <div
                  className={classes.setupNodeWrapper}
                  style={{
                    left: setupNode.x,
                    top: setupNode.y,
                    width: setupNode.width,
                    height: setupNode.height,
                  }}
                >
                  <SetupCard
                    loading={loading}
                    environmentsExist={environments.length > 0}
                    isWorkloadEditorSupported={isWorkloadEditorSupported}
                    onConfigureWorkload={handleOpenWorkloadConfig}
                  />
                </div>
              )}

              {/* Environment nodes */}
              {envNodes.map(node => {
                const env = envMap.get(node.id);
                if (!env) return null;

                return (
                  <div
                    key={node.id}
                    className={classes.nodeWrapper}
                    style={{
                      left: node.x,
                      top: node.y,
                      width: node.width,
                      height: node.height,
                    }}
                  >
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
                              env.bindingName ??
                                `${env.resourceName ?? env.name}`,
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
                              env.bindingName ??
                                `${env.resourceName ?? env.name}`,
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
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </Box>
      )}
    </>
  );
};
