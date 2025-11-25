/* eslint-disable no-nested-ternary */
import { useEffect, useState, useCallback } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Content, Page } from '@backstage/core-components';
import {
  Grid,
  CardContent,
  Typography,
  Box,
  Button,
  IconButton,
  Badge,
} from '@material-ui/core';
import { Card } from '@openchoreo/backstage-design-system';
import { Skeleton } from '@material-ui/lab';
import { makeStyles } from '@material-ui/core/styles';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import SettingsIcon from '@material-ui/icons/Settings';
import DescriptionIcon from '@material-ui/icons/Description';
import Refresh from '@material-ui/icons/Refresh';

import {
  discoveryApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  promoteToEnvironment,
  deleteReleaseBinding,
} from '../../api/environments';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
import { useEnvironmentData, Environment } from './hooks/useEnvironmentData';
import { Workload } from './Workload/Workload';
import { EnvironmentOverridesDialog } from './EnvironmentOverridesDialog';
import { ReleaseDetailsDialog } from './ReleaseDetailsDialog';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import {
  useDialogWithSelection,
  useItemActionTracker,
  useNotification,
} from '../../hooks';

const useStyles = makeStyles(theme => ({
  '@global': {
    '@keyframes spin': {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' },
    },
  },
  notificationBox: {
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid`,
    boxShadow: theme.shadows[4],
  },
  successNotification: {
    backgroundColor: theme.palette.success.light,
    borderColor: theme.palette.success.main,
    color: theme.palette.success.dark,
  },
  errorNotification: {
    backgroundColor: theme.palette.error.light,
    borderColor: theme.palette.error.main,
    color: theme.palette.error.dark,
  },
  setupCard: {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    minHeight: '300px',
    display: 'flex',
    flexDirection: 'column',
  },
  cardContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  skeletonContainer: {
    height: '200px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  deploymentStatusBox: {
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(2),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  successStatus: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
  },
  errorStatus: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
  },
  warningStatus: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
  },
  defaultStatus: {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
  },
  imageContainer: {
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(0.5),
    border: `1px solid ${theme.palette.divider}`,
    marginTop: theme.spacing(1),
    fontFamily: 'monospace',
  },
  sectionLabel: {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(1),
  },
  endpointLink: {
    color: theme.palette.primary.main,
    textDecoration: 'underline',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.875rem',
  },
  timeIcon: {
    fontSize: '1rem',
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
}));

export const Environments = () => {
  const classes = useStyles();
  const { entity } = useEntity();

  // Use the new hook for data fetching
  const { environments, loading, refetch } = useEnvironmentData(entity);

  // Cache for showing stale data during refresh
  const [staleEnvironments, setStaleEnvironments] = useState<Environment[]>([]);

  // Per-item action tracking (replaces multiple useState + Set manipulation)
  const refreshTracker = useItemActionTracker<string>();
  const promotionTracker = useItemActionTracker<string>();
  const suspendTracker = useItemActionTracker<string>();

  // Notifications with auto-cleanup (replaces notification useState + setTimeout)
  const notification = useNotification();

  // Dialog state management (replaces paired open/selected useState calls)
  const overridesDialog = useDialogWithSelection<Environment>();
  const releaseDialog = useDialogWithSelection<Environment>();

  const discovery = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  // Update stale cache when environments change
  useEffect(() => {
    if (environments.length > 0) {
      setStaleEnvironments(environments);
    }
  }, [environments]);

  // Handle per-environment refresh using the tracker hook
  const handleRefreshEnvironment = useCallback(
    (envName: string) =>
      refreshTracker.withTracking(envName, async () => {
        // Add minimum delay to ensure loading state is visible
        await Promise.all([
          refetch(),
          new Promise(resolve => setTimeout(resolve, 300)),
        ]);
      }),
    [refetch, refreshTracker],
  );

  const isWorkloadEditorSupported =
    entity.metadata.tags?.find(
      tag => tag === 'webapplication' || tag === 'service',
    ) || entity.metadata.annotations?.['openchoreo.io/component'] !== undefined;

  // Wrapper to convert refetch (void) to async function for Workload component
  const refetchAsync = async () => {
    refetch();
  };

  // Determine display environments (use stale cache if available during refresh)
  const displayEnvironments =
    staleEnvironments.length > 0 ? staleEnvironments : environments;

  const isPending = displayEnvironments.some(
    env => env.deployment.status === 'NotReady',
  );

  // Polling for pending deployments
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isPending) {
      intervalId = setInterval(() => {
        refetch();
      }, 10000); // 10 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isPending, refetch]);

  const isAlreadyPromoted = (
    sourceEnv: Environment,
    targetEnvName: string,
  ): boolean => {
    const targetEnv = displayEnvironments.find(e => e.name === targetEnvName);

    if (
      !sourceEnv.deployment.releaseName ||
      !targetEnv?.deployment.releaseName
    ) {
      return false;
    }

    return (
      sourceEnv.deployment.releaseName === targetEnv.deployment.releaseName
    );
  };

  // Dialog handlers now use the hook's built-in methods:
  // - overridesDialog.open(env) / overridesDialog.close()
  // - releaseDialog.open(env) / releaseDialog.close()

  const handleOverridesSaved = () => {
    refetch();
  };

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
        {notification.notification && (
          <Box
            position="fixed"
            top={80}
            right={24}
            zIndex={1300}
            maxWidth={400}
            className={`${classes.notificationBox} ${
              notification.notification.type === 'success'
                ? classes.successNotification
                : classes.errorNotification
            }`}
          >
            <Typography variant="body2" style={{ fontWeight: 'bold' }}>
              {notification.notification.type === 'success' ? '✓ ' : '✗ '}
              {notification.notification.message}
            </Typography>
          </Box>
        )}
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Card interactive style={{ minHeight: '300px' }}>
              {/* Make this card color different from the others */}
              <Box className={classes.setupCard}>
                <CardContent className={classes.cardContent}>
                  <Typography variant="h6" component="h4">
                    Set up
                  </Typography>

                  <Box
                    borderBottom={1}
                    borderColor="divider"
                    marginBottom={2}
                    marginTop={1}
                  />
                  {loading && environments.length === 0 ? (
                    <Box className={classes.skeletonContainer}>
                      <Skeleton variant="text" width="80%" height={20} />
                      <Skeleton
                        variant="rect"
                        width="100%"
                        height={40}
                        style={{ marginTop: 16 }}
                      />
                    </Box>
                  ) : (
                    <>
                      <Typography color="textSecondary">
                        View and manage deployment environments
                      </Typography>
                      {isWorkloadEditorSupported && (
                        <Workload onDeployed={refetchAsync} />
                      )}
                    </>
                  )}
                </CardContent>
              </Box>
            </Card>
          </Grid>
          {displayEnvironments.map(env => (
            <Grid key={env.name} item xs={12} md={3}>
              <Card interactive style={{ minHeight: '300px' }}>
                <CardContent className={classes.cardContent}>
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="h6" component="h4">
                      {env.name}
                    </Typography>
                    <Box display="flex" alignItems="center">
                      {env.deployment.releaseName && (
                        <IconButton
                          onClick={() => overridesDialog.open(env)}
                          size="small"
                          title="Configure environment overrides"
                          style={{ marginLeft: 8 }}
                        >
                          <Badge
                            color="primary"
                            variant="dot"
                            invisible={!env.hasComponentTypeOverrides}
                          >
                            <SettingsIcon
                              fontSize="inherit"
                              style={{ fontSize: '18px' }}
                            />
                          </Badge>
                        </IconButton>
                      )}
                      <IconButton
                        onClick={() => handleRefreshEnvironment(env.name)}
                        size="small"
                        disabled={refreshTracker.isActive(env.name)}
                        title={
                          refreshTracker.isActive(env.name)
                            ? 'Refreshing...'
                            : 'Refresh'
                        }
                      >
                        <Refresh
                          fontSize="inherit"
                          style={{
                            fontSize: '18px',
                            animation: refreshTracker.isActive(env.name)
                              ? 'spin 1s linear infinite'
                              : 'none',
                          }}
                        />
                      </IconButton>
                    </Box>
                  </Box>
                  {/* add a line in the ui */}
                  <Box
                    borderBottom={1}
                    borderColor="divider"
                    marginBottom={2}
                    marginTop={1}
                  />
                  {refreshTracker.isActive(env.name) ? (
                    <Box className={classes.skeletonContainer}>
                      <Skeleton variant="text" width="60%" height={24} />
                      <Skeleton
                        variant="rect"
                        width="100%"
                        height={50}
                        style={{ marginTop: 12 }}
                      />
                      <Skeleton
                        variant="text"
                        width="40%"
                        style={{ marginTop: 12 }}
                      />
                      <Skeleton variant="text" width="80%" />
                      <Skeleton
                        variant="rect"
                        width="100%"
                        height={60}
                        style={{ marginTop: 12 }}
                      />
                    </Box>
                  ) : (
                    <>
                      {env.deployment.lastDeployed && (
                        <Box display="flex" alignItems="center" mb={2}>
                          <Typography
                            variant="body2"
                            style={{ fontWeight: 500 }}
                          >
                            Deployed
                          </Typography>
                          <AccessTimeIcon className={classes.timeIcon} />
                          <Typography variant="body2" color="textSecondary">
                            {formatRelativeTime(env.deployment.lastDeployed)}
                          </Typography>
                        </Box>
                      )}
                      <Box display="flex" alignItems="center" mt={2}>
                        <Typography
                          variant="body2"
                          style={{ fontWeight: 500, marginRight: 8 }}
                        >
                          Deployment Status:
                        </Typography>
                        <StatusBadge
                          status={
                            env.deployment.status === 'Ready'
                              ? 'active'
                              : env.deployment.status === 'NotReady'
                              ? 'pending'
                              : env.deployment.status === 'Failed'
                              ? 'failed'
                              : 'not-deployed'
                          }
                        />
                        {env.deployment.releaseName && (
                          <IconButton
                            onClick={() => releaseDialog.open(env)}
                            size="small"
                            title="View release details"
                            style={{ marginLeft: 'auto' }}
                          >
                            <DescriptionIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>

                      {env.deployment.image && (
                        <Box mt={2}>
                          <Typography className={classes.sectionLabel}>
                            Image
                          </Typography>
                          <Box className={classes.imageContainer}>
                            <Typography
                              variant="body2"
                              color="textSecondary"
                              style={{
                                wordBreak: 'break-all',
                                fontSize: '0.8rem',
                              }}
                            >
                              {env.deployment.image}
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {env.deployment.status === 'Ready' &&
                        env.endpoints.length > 0 && (
                          <Box mt={2}>
                            <Typography className={classes.sectionLabel}>
                              Endpoints
                            </Typography>
                            {env.endpoints.map((endpoint, index) => (
                              <Box
                                key={index}
                                display="flex"
                                alignItems="center"
                                mt={index === 0 ? 0 : 1}
                                sx={{ minWidth: 0, width: '100%' }}
                              >
                                <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                                  <a
                                    href={endpoint.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={classes.endpointLink}
                                  >
                                    {endpoint.url}
                                  </a>
                                </Box>
                                <Box sx={{ flexShrink: 0 }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        endpoint.url,
                                      );
                                      // You could add a toast notification here
                                    }}
                                  >
                                    <FileCopyIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        )}

                      {/* Actions section - show if there are promotion targets or a binding to suspend */}
                      {((env.deployment.status === 'Ready' &&
                        env.promotionTargets &&
                        env.promotionTargets.length > 0) ||
                        env.bindingName) && (
                        <Box mt="auto" mb={2}>
                          {/* Multiple promotion targets - stack vertically */}
                          {env.deployment.status === 'Ready' &&
                            env.promotionTargets &&
                            env.promotionTargets.length > 1 &&
                            env.promotionTargets.map((target, index) => (
                              <Box
                                key={target.name}
                                display="flex"
                                justifyContent="flex-end"
                                mb={
                                  index < env.promotionTargets!.length - 1
                                    ? 2
                                    : env.bindingName
                                    ? 2
                                    : 0
                                }
                              >
                                <Button
                                  variant="contained"
                                  color="primary"
                                  size="small"
                                  disabled={
                                    promotionTracker.isActive(target.name) ||
                                    isAlreadyPromoted(env, target.name)
                                  }
                                  onClick={() =>
                                    promotionTracker
                                      .withTracking(target.name, async () => {
                                        await promoteToEnvironment(
                                          entity,
                                          discovery,
                                          identityApi,
                                          env.name.toLowerCase(),
                                          target.name.toLowerCase(),
                                        );
                                        await refetch();
                                        notification.showSuccess(
                                          `Component promoted from ${env.name} to ${target.name}`,
                                        );
                                      })
                                      .catch(err =>
                                        notification.showError(
                                          `Error promoting: ${err}`,
                                        ),
                                      )
                                  }
                                >
                                  {isAlreadyPromoted(env, target.name)
                                    ? `Promoted to ${target.name}`
                                    : promotionTracker.isActive(target.name)
                                    ? 'Promoting...'
                                    : `Promote to ${target.name}`}
                                  {!isAlreadyPromoted(env, target.name) &&
                                    target.requiresApproval &&
                                    !promotionTracker.isActive(target.name) &&
                                    ' (Approval Required)'}
                                </Button>
                              </Box>
                            ))}

                          {/* Single promotion target and suspend button - show in same row */}
                          {((env.deployment.status === 'Ready' &&
                            env.promotionTargets &&
                            env.promotionTargets.length === 1) ||
                            env.bindingName) && (
                            <Box
                              display="flex"
                              flexWrap="wrap"
                              justifyContent="flex-end"
                            >
                              {/* Single promotion button */}
                              {env.deployment.status === 'Ready' &&
                                env.promotionTargets &&
                                env.promotionTargets.length === 1 && (
                                  <Button
                                    style={{ marginRight: '8px' }}
                                    variant="contained"
                                    color="primary"
                                    size="small"
                                    disabled={
                                      promotionTracker.isActive(
                                        env.promotionTargets[0].name,
                                      ) ||
                                      isAlreadyPromoted(
                                        env,
                                        env.promotionTargets[0].name,
                                      )
                                    }
                                    onClick={() => {
                                      const targetName =
                                        env.promotionTargets![0].name;
                                      promotionTracker
                                        .withTracking(targetName, async () => {
                                          await promoteToEnvironment(
                                            entity,
                                            discovery,
                                            identityApi,
                                            env.name.toLowerCase(),
                                            targetName.toLowerCase(),
                                          );
                                          await refetch();
                                          notification.showSuccess(
                                            `Component promoted from ${env.name} to ${targetName}`,
                                          );
                                        })
                                        .catch(err =>
                                          notification.showError(
                                            `Error promoting: ${err}`,
                                          ),
                                        );
                                    }}
                                  >
                                    {isAlreadyPromoted(
                                      env,
                                      env.promotionTargets[0].name,
                                    )
                                      ? `Promoted`
                                      : promotionTracker.isActive(
                                          env.promotionTargets[0].name,
                                        )
                                      ? 'Promoting...'
                                      : 'Promote'}
                                    {!isAlreadyPromoted(
                                      env,
                                      env.promotionTargets[0].name,
                                    ) &&
                                      env.promotionTargets[0]
                                        .requiresApproval &&
                                      !promotionTracker.isActive(
                                        env.promotionTargets[0].name,
                                      ) &&
                                      ' (Approval Required)'}
                                  </Button>
                                )}

                              {/* Suspend button - show whenever there's a binding */}
                              {env.bindingName && (
                                <Button
                                  variant="outlined"
                                  color="secondary"
                                  size="small"
                                  disabled={suspendTracker.isActive(env.name)}
                                  onClick={() =>
                                    suspendTracker
                                      .withTracking(env.name, async () => {
                                        await deleteReleaseBinding(
                                          entity,
                                          discovery,
                                          identityApi,
                                          env.name.toLowerCase(),
                                        );
                                        await refetch();
                                        notification.showSuccess(
                                          `Component suspended from ${env.name} successfully`,
                                        );
                                      })
                                      .catch(err =>
                                        notification.showError(
                                          `Error suspending: ${err}`,
                                        ),
                                      )
                                  }
                                >
                                  {suspendTracker.isActive(env.name)
                                    ? 'Suspending...'
                                    : 'Suspend'}
                                </Button>
                              )}
                            </Box>
                          )}
                        </Box>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <EnvironmentOverridesDialog
          open={overridesDialog.isOpen}
          onClose={overridesDialog.close}
          environment={overridesDialog.selected}
          entity={entity}
          onSaved={handleOverridesSaved}
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
