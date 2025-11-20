/* eslint-disable no-nested-ternary */
import { useCallback, useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Content, Page } from '@backstage/core-components';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  IconButton,
  Badge,
} from '@material-ui/core';
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
import { formatRelativeTime } from '../../utils/timeUtils';
import { useEnvironmentData, Environment } from './hooks/useEnvironmentData';
import { Workload } from './Workload/Workload';
import { EnvironmentOverridesDialog } from './EnvironmentOverridesDialog';
import { ReleaseDetailsDialog } from './ReleaseDetailsDialog';

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
  environmentCard: {
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

  // Per-environment refresh state
  const [refreshingEnvironments, setRefreshingEnvironments] = useState<
    Set<string>
  >(new Set());
  const [staleEnvironments, setStaleEnvironments] = useState<Environment[]>([]);

  // Other state
  const [promotingTo, setPromotingTo] = useState<string | null>(null);
  const [updatingBinding, setUpdatingBinding] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [overridesDialogOpen, setOverridesDialogOpen] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] =
    useState<Environment | null>(null);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [selectedReleaseEnvironment, setSelectedReleaseEnvironment] =
    useState<Environment | null>(null);
  const discovery = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  // Update stale cache when environments change
  useEffect(() => {
    if (environments.length > 0) {
      setStaleEnvironments(environments);
    }
  }, [environments]);

  // Handle per-environment refresh
  const handleRefreshEnvironment = useCallback(
    async (envName: string) => {
      setRefreshingEnvironments(prev => new Set(prev).add(envName));
      try {
        // Add minimum delay to ensure loading state is visible
        const [result] = await Promise.all([
          refetch(),
          new Promise(resolve => setTimeout(resolve, 300)),
        ]);
        return result;
      } finally {
        setRefreshingEnvironments(prev => {
          const newSet = new Set(prev);
          newSet.delete(envName);
          return newSet;
        });
      }
    },
    [refetch],
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
    env => env.deployment.status === 'pending',
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

  const handleOpenOverridesDialog = (env: Environment) => {
    setSelectedEnvironment(env);
    setOverridesDialogOpen(true);
  };

  const handleCloseOverridesDialog = () => {
    setOverridesDialogOpen(false);
    setSelectedEnvironment(null);
  };

  const handleOpenReleaseDialog = (env: Environment) => {
    setSelectedReleaseEnvironment(env);
    setReleaseDialogOpen(true);
  };

  const handleCloseReleaseDialog = () => {
    setReleaseDialogOpen(false);
    setSelectedReleaseEnvironment(null);
  };

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
        {notification && (
          <Box
            position="fixed"
            top={80}
            right={24}
            zIndex={1300}
            maxWidth={400}
            className={`${classes.notificationBox} ${
              notification.type === 'success'
                ? classes.successNotification
                : classes.errorNotification
            }`}
          >
            <Typography variant="body2" style={{ fontWeight: 'bold' }}>
              {notification.type === 'success' ? '✓ ' : '✗ '}
              {notification.message}
            </Typography>
          </Box>
        )}
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Card className={classes.environmentCard}>
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
                        <Workload
                          onDeployed={refetchAsync}
                          isWorking={isPending}
                        />
                      )}
                    </>
                  )}
                </CardContent>
              </Box>
            </Card>
          </Grid>
          {displayEnvironments.map(env => (
            <Grid key={env.name} item xs={12} md={3}>
              <Card className={classes.environmentCard}>
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
                          onClick={() => handleOpenOverridesDialog(env)}
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
                        disabled={refreshingEnvironments.has(env.name)}
                        title={
                          refreshingEnvironments.has(env.name)
                            ? 'Refreshing...'
                            : 'Refresh'
                        }
                      >
                        <Refresh
                          fontSize="inherit"
                          style={{
                            fontSize: '18px',
                            animation: refreshingEnvironments.has(env.name)
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
                  {refreshingEnvironments.has(env.name) ? (
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
                      <Box
                        className={`${classes.deploymentStatusBox} ${
                          env.deployment.status === 'success'
                            ? classes.successStatus
                            : env.deployment.status === 'failed'
                            ? classes.errorStatus
                            : env.deployment.status === 'pending'
                            ? classes.warningStatus
                            : env.deployment.status === 'suspended'
                            ? classes.warningStatus
                            : classes.defaultStatus
                        }`}
                      >
                        <Typography variant="body2" style={{ fontWeight: 500 }}>
                          Deployment Status:
                        </Typography>
                        <Typography
                          variant="body2"
                          style={{
                            fontWeight:
                              env.deployment.status === 'success'
                                ? 'bold'
                                : 500,
                          }}
                        >
                          {env.deployment.status === 'success'
                            ? 'Active'
                            : env.deployment.status === 'pending'
                            ? 'Pending'
                            : env.deployment.status === 'not-deployed'
                            ? 'Not Deployed'
                            : env.deployment.status === 'suspended'
                            ? 'Suspended'
                            : 'Failed'}
                        </Typography>
                        {env.deployment.releaseName && (
                          <IconButton
                            onClick={() => handleOpenReleaseDialog(env)}
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

                      {env.deployment.status === 'success' &&
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

                      {/* Actions section - show if deployment is successful or suspended */}
                      {((env.deployment.status === 'success' &&
                        env.promotionTargets &&
                        env.promotionTargets.length > 0) ||
                        ((env.deployment.status === 'success' ||
                          env.deployment.status === 'suspended') &&
                          env.bindingName)) && (
                        <Box mt="auto" mb={2}>
                          {/* Multiple promotion targets - stack vertically */}
                          {env.deployment.status === 'success' &&
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
                                    : (env.deployment.status === 'success' ||
                                        env.deployment.status ===
                                          'suspended') &&
                                      env.bindingName
                                    ? 2
                                    : 0
                                }
                              >
                                <Button
                                  variant="contained"
                                  color="primary"
                                  size="small"
                                  disabled={
                                    promotingTo === target.name ||
                                    isAlreadyPromoted(env, target.name)
                                  }
                                  onClick={async () => {
                                    try {
                                      setPromotingTo(target.name);
                                      await promoteToEnvironment(
                                        entity,
                                        discovery,
                                        identityApi,
                                        env.name.toLowerCase(), // source environment
                                        target.name.toLowerCase(), // target environment
                                      );

                                      // Refetch environments to get updated data
                                      await refetch();

                                      setNotification({
                                        message: `Component promoted from ${env.name} to ${target.name}`,
                                        type: 'success',
                                      });

                                      // Clear notification after 5 seconds
                                      setTimeout(
                                        () => setNotification(null),
                                        5000,
                                      );
                                    } catch (err) {
                                      setNotification({
                                        message: `Error promoting: ${err}`,
                                        type: 'error',
                                      });

                                      // Clear notification after 7 seconds for errors
                                      setTimeout(
                                        () => setNotification(null),
                                        7000,
                                      );
                                    } finally {
                                      setPromotingTo(null);
                                    }
                                  }}
                                >
                                  {isAlreadyPromoted(env, target.name)
                                    ? `Promoted to ${target.name}`
                                    : promotingTo === target.name
                                    ? 'Promoting...'
                                    : `Promote to ${target.name}`}
                                  {!isAlreadyPromoted(env, target.name) &&
                                    target.requiresApproval &&
                                    !promotingTo &&
                                    ' (Approval Required)'}
                                </Button>
                              </Box>
                            ))}

                          {/* Single promotion target and suspend button - show in same row */}
                          {((env.deployment.status === 'success' &&
                            env.promotionTargets &&
                            env.promotionTargets.length === 1) ||
                            ((env.deployment.status === 'success' ||
                              env.deployment.status === 'suspended') &&
                              env.bindingName)) && (
                            <Box
                              display="flex"
                              flexWrap="wrap"
                              justifyContent="flex-end"
                            >
                              {/* Single promotion button */}
                              {env.deployment.status === 'success' &&
                                env.promotionTargets &&
                                env.promotionTargets.length === 1 && (
                                  <Button
                                    style={{ marginRight: '8px' }}
                                    variant="contained"
                                    color="primary"
                                    size="small"
                                    disabled={
                                      promotingTo ===
                                        env.promotionTargets[0].name ||
                                      isAlreadyPromoted(
                                        env,
                                        env.promotionTargets[0].name,
                                      )
                                    }
                                    onClick={async () => {
                                      try {
                                        setPromotingTo(
                                          env.promotionTargets![0].name,
                                        );
                                        await promoteToEnvironment(
                                          entity,
                                          discovery,
                                          identityApi,
                                          env.name.toLowerCase(), // source environment
                                          env.promotionTargets![0].name.toLowerCase(), // target environment
                                        );

                                        // Refetch environments to get updated data
                                        await refetch();

                                        setNotification({
                                          message: `Component promoted from ${
                                            env.name
                                          } to ${
                                            env.promotionTargets![0].name
                                          }`,
                                          type: 'success',
                                        });

                                        // Clear notification after 5 seconds
                                        setTimeout(
                                          () => setNotification(null),
                                          5000,
                                        );
                                      } catch (err) {
                                        setNotification({
                                          message: `Error promoting: ${err}`,
                                          type: 'error',
                                        });

                                        // Clear notification after 7 seconds for errors
                                        setTimeout(
                                          () => setNotification(null),
                                          7000,
                                        );
                                      } finally {
                                        setPromotingTo(null);
                                      }
                                    }}
                                  >
                                    {isAlreadyPromoted(
                                      env,
                                      env.promotionTargets[0].name,
                                    )
                                      ? `Promoted`
                                      : promotingTo ===
                                        env.promotionTargets[0].name
                                      ? 'Promoting...'
                                      : 'Promote'}
                                    {!isAlreadyPromoted(
                                      env,
                                      env.promotionTargets[0].name,
                                    ) &&
                                      env.promotionTargets[0]
                                        .requiresApproval &&
                                      !promotingTo &&
                                      ' (Approval Required)'}
                                  </Button>
                                )}

                              {/* Suspend button */}
                              {env.deployment.status === 'success' &&
                                env.bindingName && (
                                  <Button
                                    variant="outlined"
                                    color="secondary"
                                    size="small"
                                    disabled={updatingBinding === env.name}
                                    onClick={async () => {
                                      try {
                                        setUpdatingBinding(env.name);
                                        await deleteReleaseBinding(
                                          entity,
                                          discovery,
                                          identityApi,
                                          env.name.toLowerCase(),
                                        );

                                        // Refresh the environments data
                                        await refetch();

                                        setNotification({
                                          message: `Component suspended from ${env.name} successfully`,
                                          type: 'success',
                                        });

                                        // Clear notification after 5 seconds
                                        setTimeout(
                                          () => setNotification(null),
                                          5000,
                                        );
                                      } catch (err) {
                                        setNotification({
                                          message: `Error suspending: ${err}`,
                                          type: 'error',
                                        });

                                        // Clear notification after 7 seconds for errors
                                        setTimeout(
                                          () => setNotification(null),
                                          7000,
                                        );
                                      } finally {
                                        setUpdatingBinding(null);
                                      }
                                    }}
                                  >
                                    {updatingBinding === env.name
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
          open={overridesDialogOpen}
          onClose={handleCloseOverridesDialog}
          environment={selectedEnvironment}
          entity={entity}
          onSaved={handleOverridesSaved}
        />

        <ReleaseDetailsDialog
          open={releaseDialogOpen}
          onClose={handleCloseReleaseDialog}
          environmentName={
            selectedReleaseEnvironment?.resourceName ||
            selectedReleaseEnvironment?.name ||
            ''
          }
          environmentDisplayName={selectedReleaseEnvironment?.name}
          entity={entity}
        />
      </Content>
    </Page>
  );
};
