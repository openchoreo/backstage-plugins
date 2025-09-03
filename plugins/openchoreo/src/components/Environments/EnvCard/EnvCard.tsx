import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  IconButton,
} from '@material-ui/core';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import Refresh from '@material-ui/icons/Refresh';
import { Entity } from '@backstage/catalog-model';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import {
  promoteToEnvironment,
  updateComponentBinding,
} from '../../../api/environments';
import { formatRelativeTime } from '../../../utils/timeUtils';
import { Alert } from '@material-ui/lab';

const useStyles = makeStyles(theme => ({
  deploymentStatusBox: {
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(2),
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
    boxShadow: theme.shadows[0],
    marginTop: theme.spacing(0.5),
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

interface EndpointInfo {
  name: string;
  type: string;
  url: string;
  visibility: 'project' | 'organization' | 'public';
}

interface Environment {
  name: string;
  bindingName?: string;
  deployment: {
    status: 'success' | 'failed' | 'pending' | 'not-deployed' | 'suspended';
    lastDeployed?: string;
    image?: string;
    statusMessage?: string;
  };
  endpoints: EndpointInfo[];
  promotionTargets?: {
    name: string;
    requiresApproval?: boolean;
    isManualApprovalRequired?: boolean;
  }[];
}

interface EnvCardProps {
  env: Environment;
  entity: Entity;
  discovery: DiscoveryApi;
  identityApi: IdentityApi;
  promotingTo: string | null;
  setPromotingTo: (value: string | null) => void;
  updatingBinding: string | null;
  setUpdatingBinding: (value: string | null) => void;
  setEnvironmentsData: (data: Environment[]) => void;
  setNotification: (
    notification: { message: string; type: 'success' | 'error' } | null,
  ) => void;
  fetchEnvironmentsData: () => Promise<void>;
}

export const EnvCard: React.FC<EnvCardProps> = ({
  env,
  entity,
  discovery,
  identityApi,
  promotingTo,
  setPromotingTo,
  updatingBinding,
  setUpdatingBinding,
  setEnvironmentsData,
  setNotification,
  fetchEnvironmentsData,
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const getStatusLevel = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'failed':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'info';
    }
  };

  //   if (env.deployment.status === 'success') return 'Active';
  //   if (env.deployment.status === 'pending') return 'Pending';
  //   if (env.deployment.status === 'not-deployed') return 'Not Deployed';
  //   if (env.deployment.status === 'suspended') return 'Suspended';
  //   return 'Failed';
  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'success':
        return 'Active';
      case 'pending':
        return 'Pending';
      case 'suspended':
        return 'Suspended';
      case 'not-deployed':
        return 'Not Deployed';
      default:
        return 'Failed';
    }
  };

  return (
    <Box key={env.name} minWidth={theme.spacing(40)} width={theme.spacing(40)}>
      <Card>
        <CardContent>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="h6" component="h4">
              {env.name}
            </Typography>
            <IconButton onClick={() => fetchEnvironmentsData()}>
              <Refresh fontSize="inherit" style={{ fontSize: '18px' }} />
            </IconButton>
          </Box>
          {/* add a line in the ui */}
          <Box
            borderBottom={1}
            borderColor="divider"
            marginBottom={2}
            marginTop={1}
          />
          {env.deployment.lastDeployed && (
            <Box display="flex" alignItems="center">
              <Typography variant="body2" color="textSecondary">
                Deployed
              </Typography>
              <AccessTimeIcon className={classes.timeIcon} />
              <Typography variant="body2" color="textSecondary">
                {formatRelativeTime(env.deployment.lastDeployed)}
              </Typography>
            </Box>
          )}
          {env.deployment.status && (
            <Alert
              severity={getStatusLevel(env.deployment.status)}
              style={{ marginTop: '10px' }}
            >
              <Typography variant="body2" color="textSecondary">
                Deployment Status: &nbsp;
                <Typography
                  variant="body2"
                  component="span"
                  color="textPrimary"
                >
                  {getStatusMessage(env.deployment.status)}
                </Typography>
              </Typography>
            </Alert>
          )}
          {env.deployment.statusMessage && (
            <Box mt={1}>
              <Typography variant="caption" color="textSecondary">
                {env.deployment.statusMessage}
              </Typography>
            </Box>
          )}

          {env.deployment.image && (
            <>
              <Box display="flex" alignItems="center" mt={2}>
                <Typography variant="body2" color="textSecondary">
                  Image
                </Typography>
              </Box>
              <Box
                display="flex"
                alignItems="center"
                className={classes.imageContainer}
              >
                <Typography
                  variant="caption"
                  color="textSecondary"
                  style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}
                >
                  {env.deployment.image}
                </Typography>
              </Box>
            </>
          )}

          {env.deployment.status === 'success' && env.endpoints.length > 0 && (
            <>
              <Box display="flex" alignItems="center" mt={2}>
                <Typography variant="body2" color="textSecondary">
                  Endpoints
                </Typography>
              </Box>
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
                        navigator.clipboard.writeText(endpoint.url);
                        // You could add a toast notification here
                      }}
                    >
                      <FileCopyIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ))}
            </>
          )}

          {/* Actions section - show if deployment is successful or suspended */}
          {((env.deployment.status === 'success' &&
            env.promotionTargets &&
            env.promotionTargets.length > 0) ||
            ((env.deployment.status === 'success' ||
              env.deployment.status === 'suspended') &&
              env.bindingName)) && (
            <Box mt={3}>
              {/* Multiple promotion targets - stack vertically */}
              {env.deployment.status === 'success' &&
                env.promotionTargets &&
                env.promotionTargets.length > 1 &&
                env.promotionTargets.map((target, index) => (
                  <Box
                    key={target.name}
                    mb={(() => {
                      if (index < env.promotionTargets!.length - 1) return 2;
                      if (
                        (env.deployment.status === 'success' ||
                          env.deployment.status === 'suspended') &&
                        env.bindingName
                      )
                        return 2;
                      return 0;
                    })()}
                  >
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      disabled={promotingTo === target.name}
                      onClick={async () => {
                        try {
                          setPromotingTo(target.name);
                          const result = await promoteToEnvironment(
                            entity,
                            discovery,
                            identityApi,
                            env.name.toLowerCase(), // source environment
                            target.name.toLowerCase(), // target environment
                          );

                          // Update environments state with fresh data from promotion result
                          setEnvironmentsData(result as Environment[]);

                          setNotification({
                            message: `Component promoted from ${env.name} to ${target.name}`,
                            type: 'success',
                          });

                          // Clear notification after 5 seconds
                          setTimeout(() => setNotification(null), 5000);
                        } catch (err) {
                          setNotification({
                            message: `Error promoting: ${err}`,
                            type: 'error',
                          });

                          // Clear notification after 7 seconds for errors
                          setTimeout(() => setNotification(null), 7000);
                        } finally {
                          setPromotingTo(null);
                        }
                      }}
                    >
                      {promotingTo === target.name
                        ? 'Promoting...'
                        : `Promote to ${target.name}`}
                      {target.requiresApproval &&
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
                <Box display="flex" flexWrap="wrap">
                  {/* Single promotion button */}
                  {env.deployment.status === 'success' &&
                    env.promotionTargets &&
                    env.promotionTargets.length === 1 && (
                      <Button
                        style={{ marginRight: '8px' }}
                        variant="contained"
                        color="primary"
                        size="small"
                        disabled={promotingTo === env.promotionTargets[0].name}
                        onClick={async () => {
                          try {
                            setPromotingTo(env.promotionTargets![0].name);
                            const result = await promoteToEnvironment(
                              entity,
                              discovery,
                              identityApi,
                              env.name.toLowerCase(), // source environment
                              env.promotionTargets![0].name.toLowerCase(), // target environment
                            );

                            // Update environments state with fresh data from promotion result
                            setEnvironmentsData(result as Environment[]);

                            setNotification({
                              message: `Component promoted from ${
                                env.name
                              } to ${env.promotionTargets![0].name}`,
                              type: 'success',
                            });

                            // Clear notification after 5 seconds
                            setTimeout(() => setNotification(null), 5000);
                          } catch (err) {
                            setNotification({
                              message: `Error promoting: ${err}`,
                              type: 'error',
                            });

                            // Clear notification after 7 seconds for errors
                            setTimeout(() => setNotification(null), 7000);
                          } finally {
                            setPromotingTo(null);
                          }
                        }}
                      >
                        {promotingTo === env.promotionTargets[0].name
                          ? 'Promoting...'
                          : 'Promote'}
                        {env.promotionTargets[0].requiresApproval &&
                          !promotingTo &&
                          ' (Approval Required)'}
                      </Button>
                    )}

                  {/* Suspend/Re-deploy button */}
                  {(env.deployment.status === 'success' ||
                    env.deployment.status === 'suspended') &&
                    env.bindingName && (
                      <Button
                        variant="outlined"
                        color={
                          env.deployment.status === 'suspended'
                            ? 'primary'
                            : 'default'
                        }
                        size="small"
                        disabled={updatingBinding === env.name}
                        onClick={async () => {
                          try {
                            setUpdatingBinding(env.name);
                            const newState =
                              env.deployment.status === 'suspended'
                                ? 'Active'
                                : 'Suspend';
                            await updateComponentBinding(
                              entity,
                              discovery,
                              identityApi,
                              env.bindingName!,
                              newState,
                            );

                            // Refresh the environments data
                            await fetchEnvironmentsData();

                            setNotification({
                              message: `Deployment ${
                                newState === 'Active'
                                  ? 're-deployed'
                                  : 'suspended'
                              } successfully`,
                              type: 'success',
                            });

                            // Clear notification after 5 seconds
                            setTimeout(() => setNotification(null), 5000);
                          } catch (err) {
                            setNotification({
                              message: `Error updating deployment: ${err}`,
                              type: 'error',
                            });

                            // Clear notification after 7 seconds for errors
                            setTimeout(() => setNotification(null), 7000);
                          } finally {
                            setUpdatingBinding(null);
                          }
                        }}
                      >
                        {(() => {
                          if (updatingBinding === env.name)
                            return 'Updating...';
                          if (env.deployment.status === 'suspended')
                            return 'Re-deploy';
                          return 'Suspend';
                        })()}
                      </Button>
                    )}
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
