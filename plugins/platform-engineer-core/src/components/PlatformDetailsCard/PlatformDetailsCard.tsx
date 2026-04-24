import { Box, Card, CardActionArea, Typography, Grid } from '@material-ui/core';
import { useTheme } from '@material-ui/core/styles';
import StorageIcon from '@material-ui/icons/Storage';
import BuildIcon from '@material-ui/icons/Build';
import VisibilityIcon from '@material-ui/icons/Visibility';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import {
  DataPlaneWithEnvironments,
  WorkflowPlane,
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
  workflowPlanes?: WorkflowPlane[];
  clusterWorkflowPlanes?: WorkflowPlane[];
  observabilityPlanes?: ObservabilityPlane[];
  clusterObservabilityPlanes?: ObservabilityPlane[];
}

export const PlatformDetailsCard = ({
  dataplanesWithEnvironments,
  clusterDataplanes = [],
  workflowPlanes = [],
  clusterWorkflowPlanes = [],
  observabilityPlanes = [],
  clusterObservabilityPlanes = [],
}: PlatformDetailsCardProps) => {
  const classes = useStyles();
  const theme = useTheme();
  const navigate = useNavigate();

  const hasAnyPlanes =
    dataplanesWithEnvironments.length > 0 ||
    clusterDataplanes.length > 0 ||
    workflowPlanes.length > 0 ||
    clusterWorkflowPlanes.length > 0 ||
    observabilityPlanes.length > 0 ||
    clusterObservabilityPlanes.length > 0;

  const renderPlaneSection = (
    title: string,
    icon: React.ReactElement,
    planes: PlaneItem[],
    detailPath: (plane: PlaneItem) => string,
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
                <CardActionArea
                  className={classes.planeCardActionArea}
                  disableRipple
                  onClick={() => navigate(detailPath(plane))}
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
                                  ? theme.palette.success.main
                                  : theme.palette.error.main,
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
                </CardActionArea>
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
          )}
          {renderPlaneSection(
            'Workflow Planes',
            <BuildIcon className={classes.planeSectionIcon} />,
            workflowPlanes,
            bp => `/catalog/${bp.namespaceName}/workflowplane/${bp.name}`,
          )}
          {renderPlaneSection(
            'Observability Planes',
            <VisibilityIcon className={classes.planeSectionIcon} />,
            observabilityPlanes,
            op => `/catalog/${op.namespaceName}/observabilityplane/${op.name}`,
          )}
          {renderPlaneSection(
            'Cluster Data Planes',
            <StorageIcon className={classes.planeSectionIcon} />,
            clusterDataplanes,
            dp => `/catalog/openchoreo-cluster/clusterdataplane/${dp.name}`,
          )}
          {renderPlaneSection(
            'Cluster Workflow Planes',
            <BuildIcon className={classes.planeSectionIcon} />,
            clusterWorkflowPlanes,
            bp => `/catalog/openchoreo-cluster/clusterworkflowplane/${bp.name}`,
          )}
          {renderPlaneSection(
            'Cluster Observability Planes',
            <VisibilityIcon className={classes.planeSectionIcon} />,
            clusterObservabilityPlanes,
            op =>
              `/catalog/openchoreo-cluster/clusterobservabilityplane/${op.name}`,
          )}
        </Grid>
      )}
    </Box>
  );
};
