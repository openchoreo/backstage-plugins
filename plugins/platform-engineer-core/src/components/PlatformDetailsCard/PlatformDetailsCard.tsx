import {
  Box,
  Card,
  Typography,
  IconButton,
  Tooltip,
  Grid,
} from '@material-ui/core';
import StorageIcon from '@material-ui/icons/Storage';
import BuildIcon from '@material-ui/icons/Build';
import VisibilityIcon from '@material-ui/icons/Visibility';
import LaunchIcon from '@material-ui/icons/Launch';
import clsx from 'clsx';
import { Link } from '@backstage/core-components';
import {
  DataPlaneWithEnvironments,
  BuildPlane,
  ObservabilityPlane,
} from '../../types';
import { useStyles } from './styles';
import { EmptyDataplanesState } from './EmptyDataplanesState';

interface PlatformDetailsCardProps {
  dataplanesWithEnvironments: DataPlaneWithEnvironments[];
  buildPlanes?: BuildPlane[];
  observabilityPlanes?: ObservabilityPlane[];
}

export const PlatformDetailsCard = ({
  dataplanesWithEnvironments,
  buildPlanes = [],
  observabilityPlanes = [],
}: PlatformDetailsCardProps) => {
  const classes = useStyles();

  const hasAnyPlanes =
    dataplanesWithEnvironments.length > 0 ||
    buildPlanes.length > 0 ||
    observabilityPlanes.length > 0;

  return (
    <Box className={classes.dataplaneDetailsSection}>
      {!hasAnyPlanes ? (
        <EmptyDataplanesState />
      ) : (
        <Grid container spacing={3}>
          {/* Data Planes */}
          {dataplanesWithEnvironments.length > 0 && (
            <Grid item xs={12} sm={6} md={3}>
              <Box className={classes.planeSection}>
                <Typography className={classes.planeSectionTitle}>
                  <StorageIcon className={classes.planeSectionIcon} />
                  Data Planes ({dataplanesWithEnvironments.length})
                </Typography>

                <Box className={classes.planeColumnCards}>
                  {dataplanesWithEnvironments.map(dp => (
                    <Card
                      key={`${dp.namespaceName}/${dp.name}`}
                      className={classes.planeCompactCard}
                    >
                      <Box className={classes.planeCompactInfo}>
                        <StorageIcon className={classes.planeIcon} />
                        <Box>
                          <Typography variant="h6">
                            {dp.displayName || dp.name}
                          </Typography>
                          <Box
                            display="flex"
                            alignItems="center"
                            gridGap={6}
                          >
                            <Typography
                              variant="body2"
                              color="textSecondary"
                            >
                              {dp.namespaceName}
                            </Typography>
                            {dp.agentConnected !== undefined && (
                              <Box
                                display="flex"
                                alignItems="center"
                                gridGap={4}
                              >
                                <span
                                  className={clsx(
                                    classes.agentDot,
                                    dp.agentConnected
                                      ? classes.agentDotConnected
                                      : classes.agentDotDisconnected,
                                  )}
                                />
                                <Typography
                                  variant="body2"
                                  style={{
                                    color: dp.agentConnected
                                      ? '#10b981'
                                      : '#ef4444',
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  {dp.agentConnected
                                    ? 'Connected'
                                    : 'Disconnected'}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </Box>
                      <Tooltip title="View DataPlane Details">
                        <IconButton
                          size="small"
                          component={Link}
                          to={`/catalog/${dp.namespaceName}/dataplane/${dp.name}`}
                        >
                          <LaunchIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Card>
                  ))}
                </Box>
              </Box>
            </Grid>
          )}

          {/* Build Planes */}
          {buildPlanes.length > 0 && (
            <Grid item xs={12} sm={6} md={3}>
              <Box className={classes.planeSection}>
                <Typography className={classes.planeSectionTitle}>
                  <BuildIcon className={classes.planeSectionIcon} />
                  Build Planes ({buildPlanes.length})
                </Typography>

                <Box className={classes.planeColumnCards}>
                  {buildPlanes.map(bp => (
                    <Card
                      key={`${bp.namespaceName}/${bp.name}`}
                      className={classes.planeCompactCard}
                    >
                      <Box className={classes.planeCompactInfo}>
                        <BuildIcon className={classes.planeIcon} />
                        <Box>
                          <Typography variant="h6">
                            {bp.displayName || bp.name}
                          </Typography>
                          <Box
                            display="flex"
                            alignItems="center"
                            gridGap={6}
                          >
                            <Typography
                              variant="body2"
                              color="textSecondary"
                            >
                              {bp.namespaceName}
                            </Typography>
                            {bp.agentConnected !== undefined && (
                              <Box
                                display="flex"
                                alignItems="center"
                                gridGap={4}
                              >
                                <span
                                  className={clsx(
                                    classes.agentDot,
                                    bp.agentConnected
                                      ? classes.agentDotConnected
                                      : classes.agentDotDisconnected,
                                  )}
                                />
                                <Typography
                                  variant="body2"
                                  style={{
                                    color: bp.agentConnected
                                      ? '#10b981'
                                      : '#ef4444',
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  {bp.agentConnected
                                    ? 'Connected'
                                    : 'Disconnected'}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </Box>
                      <Tooltip title="View Build Plane Details">
                        <IconButton
                          size="small"
                          component={Link}
                          to={`/catalog/${bp.namespaceName}/buildplane/${bp.name}`}
                        >
                          <LaunchIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Card>
                  ))}
                </Box>
              </Box>
            </Grid>
          )}

          {/* Observability Planes */}
          {observabilityPlanes.length > 0 && (
            <Grid item xs={12} sm={6} md={3}>
              <Box className={classes.planeSection}>
                <Typography className={classes.planeSectionTitle}>
                  <VisibilityIcon className={classes.planeSectionIcon} />
                  Observability Planes ({observabilityPlanes.length})
                </Typography>

                <Box className={classes.planeColumnCards}>
                  {observabilityPlanes.map(op => (
                    <Card
                      key={`${op.namespaceName}/${op.name}`}
                      className={classes.planeCompactCard}
                    >
                      <Box className={classes.planeCompactInfo}>
                        <VisibilityIcon className={classes.planeIcon} />
                        <Box>
                          <Typography variant="h6">
                            {op.displayName || op.name}
                          </Typography>
                          <Box
                            display="flex"
                            alignItems="center"
                            gridGap={6}
                          >
                            <Typography
                              variant="body2"
                              color="textSecondary"
                            >
                              {op.namespaceName}
                            </Typography>
                            {op.agentConnected !== undefined && (
                              <Box
                                display="flex"
                                alignItems="center"
                                gridGap={4}
                              >
                                <span
                                  className={clsx(
                                    classes.agentDot,
                                    op.agentConnected
                                      ? classes.agentDotConnected
                                      : classes.agentDotDisconnected,
                                  )}
                                />
                                <Typography
                                  variant="body2"
                                  style={{
                                    color: op.agentConnected
                                      ? '#10b981'
                                      : '#ef4444',
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  {op.agentConnected
                                    ? 'Connected'
                                    : 'Disconnected'}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </Box>
                      <Tooltip title="View Observability Plane Details">
                        <IconButton
                          size="small"
                          component={Link}
                          to={`/catalog/${op.namespaceName}/observabilityplane/${op.name}`}
                        >
                          <LaunchIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Card>
                  ))}
                </Box>
              </Box>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};
