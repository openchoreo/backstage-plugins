import { Box, Typography, IconButton, Tooltip } from '@material-ui/core';
import StorageIcon from '@material-ui/icons/Storage';
import BuildIcon from '@material-ui/icons/Build';
import VisibilityIcon from '@material-ui/icons/Visibility';
import CloudIcon from '@material-ui/icons/Cloud';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import LaunchIcon from '@material-ui/icons/Launch';
import WifiIcon from '@material-ui/icons/Wifi';
import WifiOffIcon from '@material-ui/icons/WifiOff';
import { Link } from '@backstage/core-components';
import {
  DataPlaneWithEnvironments,
  BuildPlane,
  ObservabilityPlane,
} from '../../types';
import { useStyles } from './styles';
import { EmptyDataplanesState } from './EmptyDataplanesState';
import { EnvironmentsGrid } from './EnvironmentsGrid';

interface PlatformDetailsCardProps {
  dataplanesWithEnvironments: DataPlaneWithEnvironments[];
  buildPlanes?: BuildPlane[];
  observabilityPlanes?: ObservabilityPlane[];
  expandedDataplanes: Set<string>;
  onToggleDataplaneExpansion: (dataplaneName: string) => void;
}

export const PlatformDetailsCard = ({
  dataplanesWithEnvironments,
  buildPlanes = [],
  observabilityPlanes = [],
  expandedDataplanes,
  onToggleDataplaneExpansion,
}: PlatformDetailsCardProps) => {
  const classes = useStyles();

  return (
    <Box className={classes.dataplaneDetailsSection}>
      <Typography className={classes.dataplaneDetailTitle} variant="h3">
        <AccountTreeIcon />
        Platform Details
      </Typography>

      {dataplanesWithEnvironments.length === 0 &&
      buildPlanes.length === 0 &&
      observabilityPlanes.length === 0 ? (
        <EmptyDataplanesState />
      ) : (
        <>
          {/* Data Planes */}
          {dataplanesWithEnvironments.map(dataplane => {
            const isExpanded = expandedDataplanes.has(dataplane.name);

            return (
              <Box key={dataplane.name} className={classes.dataplaneCard}>
                {/* Dataplane Header */}
                <Box
                  className={classes.dataplaneHeader}
                  onClick={() => onToggleDataplaneExpansion(dataplane.name)}
                >
                  <Box className={classes.dataplaneTitle}>
                    <StorageIcon className={classes.dataplaneIcon} />
                    <Box>
                      <Typography variant="h6">
                        {dataplane.displayName || dataplane.name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Data Plane • {dataplane.environments.length}{' '}
                        environments • {dataplane.namespaceName}
                      </Typography>
                    </Box>
                  </Box>
                  <Box display="flex" alignItems="center" gridGap={8}>
                    <Tooltip title="View DataPlane Details">
                      <IconButton
                        size="small"
                        component={Link}
                        to={`/catalog/${dataplane.namespaceName}/dataplane/${dataplane.name}`}
                        onClick={e => e.stopPropagation()}
                      >
                        <LaunchIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </Box>
                </Box>

                {/* Expandable Environments Section */}
                {isExpanded && (
                  <Box className={classes.environmentsSection}>
                    {dataplane.description && (
                      <Typography
                        variant="body2"
                        color="textSecondary"
                        className={classes.dataplaneDescription}
                      >
                        {dataplane.description}
                      </Typography>
                    )}

                    <Typography className={classes.sectionTitle}>
                      <CloudIcon className={classes.sectionTitleIcon} />
                      Environments ({dataplane.environments.length})
                    </Typography>

                    {dataplane.environments.length === 0 ? (
                      <Box className={classes.emptyState}>
                        <CloudIcon className={classes.emptyEnvironmentsIcon} />
                        <Typography variant="body2">
                          No environments found for this dataplane
                        </Typography>
                      </Box>
                    ) : (
                      <EnvironmentsGrid environments={dataplane.environments} />
                    )}
                  </Box>
                )}
              </Box>
            );
          })}

          {/* Build Planes */}
          {buildPlanes.map(bp => (
            <Box key={bp.name} className={classes.dataplaneCard}>
              <Box className={classes.dataplaneHeader}>
                <Box className={classes.dataplaneTitle}>
                  <BuildIcon className={classes.dataplaneIcon} />
                  <Box>
                    <Typography variant="h6">
                      {bp.displayName || bp.name}
                    </Typography>
                    <Box display="flex" alignItems="center" gridGap={8}>
                      <Typography variant="body2" color="textSecondary">
                        Build Plane • {bp.namespaceName}
                      </Typography>
                      {bp.agentConnected !== undefined && (
                        <Box display="flex" alignItems="center" gridGap={4}>
                          {bp.agentConnected ? (
                            <WifiIcon
                              style={{ fontSize: '0.875rem', color: '#10b981' }}
                            />
                          ) : (
                            <WifiOffIcon
                              style={{ fontSize: '0.875rem', color: '#ef4444' }}
                            />
                          )}
                          <Typography
                            variant="body2"
                            style={{
                              color: bp.agentConnected ? '#10b981' : '#ef4444',
                              fontSize: '0.75rem',
                            }}
                          >
                            {bp.agentConnected
                              ? `Connected (${bp.agentConnectedCount ?? 0})`
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
              </Box>
            </Box>
          ))}

          {/* Observability Planes */}
          {observabilityPlanes.map(op => (
            <Box key={op.name} className={classes.dataplaneCard}>
              <Box className={classes.dataplaneHeader}>
                <Box className={classes.dataplaneTitle}>
                  <VisibilityIcon className={classes.dataplaneIcon} />
                  <Box>
                    <Typography variant="h6">
                      {op.displayName || op.name}
                    </Typography>
                    <Box display="flex" alignItems="center" gridGap={8}>
                      <Typography variant="body2" color="textSecondary">
                        Observability Plane • {op.namespaceName}
                      </Typography>
                      {op.agentConnected !== undefined && (
                        <Box display="flex" alignItems="center" gridGap={4}>
                          {op.agentConnected ? (
                            <WifiIcon
                              style={{ fontSize: '0.875rem', color: '#10b981' }}
                            />
                          ) : (
                            <WifiOffIcon
                              style={{ fontSize: '0.875rem', color: '#ef4444' }}
                            />
                          )}
                          <Typography
                            variant="body2"
                            style={{
                              color: op.agentConnected ? '#10b981' : '#ef4444',
                              fontSize: '0.75rem',
                            }}
                          >
                            {op.agentConnected
                              ? `Connected (${op.agentConnectedCount ?? 0})`
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
              </Box>
            </Box>
          ))}
        </>
      )}
    </Box>
  );
};
