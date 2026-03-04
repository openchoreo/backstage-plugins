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

type PlaneItem = {
  name: string;
  displayName?: string;
  namespaceName: string;
  agentConnected?: boolean;
};

interface PlatformDetailsCardProps {
  dataplanesWithEnvironments: DataPlaneWithEnvironments[];
  clusterDataplanes?: DataPlaneWithEnvironments[];
  buildPlanes?: BuildPlane[];
  clusterBuildPlanes?: BuildPlane[];
  observabilityPlanes?: ObservabilityPlane[];
  clusterObservabilityPlanes?: ObservabilityPlane[];
}

export const PlatformDetailsCard = ({
  dataplanesWithEnvironments,
  clusterDataplanes = [],
  buildPlanes = [],
  clusterBuildPlanes = [],
  observabilityPlanes = [],
  clusterObservabilityPlanes = [],
}: PlatformDetailsCardProps) => {
  const classes = useStyles();

  const hasAnyPlanes =
    dataplanesWithEnvironments.length > 0 ||
    clusterDataplanes.length > 0 ||
    buildPlanes.length > 0 ||
    clusterBuildPlanes.length > 0 ||
    observabilityPlanes.length > 0 ||
    clusterObservabilityPlanes.length > 0;

  const renderPlaneSection = (
    title: string,
    icon: React.ReactElement,
    planes: PlaneItem[],
    detailPath: (plane: PlaneItem) => string,
    tooltipLabel: string,
  ) => {
    if (planes.length === 0) return null;
    return (
      <Grid item xs={12} sm={6} md={4}>
        <Box className={classes.planeSection}>
          <Typography className={classes.planeSectionTitle}>
            {icon}
            {title} ({planes.length})
          </Typography>

          <Box className={classes.planeColumnCards}>
            {planes.map(plane => (
              <Card
                key={`${plane.namespaceName}/${plane.name}`}
                className={classes.planeCompactCard}
              >
                <Box className={classes.planeCompactInfo}>
                  {icon}
                  <Box>
                    <Typography variant="h6">
                      {plane.displayName || plane.name}
                    </Typography>
                    <Box display="flex" alignItems="center" gridGap={6}>
                      <Typography variant="body2" color="textSecondary">
                        {plane.namespaceName}
                      </Typography>
                      {plane.agentConnected !== undefined && (
                        <Box display="flex" alignItems="center" gridGap={4}>
                          <span
                            className={clsx(
                              classes.agentDot,
                              plane.agentConnected
                                ? classes.agentDotConnected
                                : classes.agentDotDisconnected,
                            )}
                          />
                          <Typography
                            variant="body2"
                            style={{
                              color: plane.agentConnected
                                ? '#10b981'
                                : '#ef4444',
                              fontSize: '0.75rem',
                            }}
                          >
                            {plane.agentConnected
                              ? 'Connected'
                              : 'Disconnected'}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>
                <Tooltip title={tooltipLabel}>
                  <IconButton
                    size="small"
                    component={Link}
                    to={detailPath(plane)}
                  >
                    <LaunchIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Card>
            ))}
          </Box>
        </Box>
      </Grid>
    );
  };

  return (
    <Box className={classes.dataplaneDetailsSection}>
      {!hasAnyPlanes ? (
        <EmptyDataplanesState />
      ) : (
        <Grid container spacing={3}>
          {renderPlaneSection(
            'Data Planes',
            <StorageIcon className={classes.planeSectionIcon} />,
            dataplanesWithEnvironments,
            dp => `/catalog/${dp.namespaceName}/dataplane/${dp.name}`,
            'View DataPlane Details',
          )}
          {renderPlaneSection(
            'Build Planes',
            <BuildIcon className={classes.planeSectionIcon} />,
            buildPlanes,
            bp => `/catalog/${bp.namespaceName}/buildplane/${bp.name}`,
            'View Build Plane Details',
          )}
          {renderPlaneSection(
            'Observability Planes',
            <VisibilityIcon className={classes.planeSectionIcon} />,
            observabilityPlanes,
            op => `/catalog/${op.namespaceName}/observabilityplane/${op.name}`,
            'View Observability Plane Details',
          )}
          {renderPlaneSection(
            'Cluster Data Planes',
            <StorageIcon className={classes.planeSectionIcon} />,
            clusterDataplanes,
            dp => `/catalog/openchoreo-cluster/clusterdataplane/${dp.name}`,
            'View Cluster DataPlane Details',
          )}
          {renderPlaneSection(
            'Cluster Build Planes',
            <BuildIcon className={classes.planeSectionIcon} />,
            clusterBuildPlanes,
            bp => `/catalog/openchoreo-cluster/clusterbuildplane/${bp.name}`,
            'View Cluster Build Plane Details',
          )}
          {renderPlaneSection(
            'Cluster Observability Planes',
            <VisibilityIcon className={classes.planeSectionIcon} />,
            clusterObservabilityPlanes,
            op =>
              `/catalog/openchoreo-cluster/clusterobservabilityplane/${op.name}`,
            'View Cluster Observability Plane Details',
          )}
        </Grid>
      )}
    </Box>
  );
};
