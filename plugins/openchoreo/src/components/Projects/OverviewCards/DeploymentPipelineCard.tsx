import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, IconButton, Tooltip, Typography } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import TimelineIcon from '@material-ui/icons/Timeline';
import EditIcon from '@material-ui/icons/Edit';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import { Card } from '@openchoreo/backstage-design-system';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useDeploymentPipeline } from '../hooks';
import { useProjectOverviewCardStyles } from './styles';
import {
  PipelineFlowVisualization,
  ForbiddenState,
  useProjectUpdatePermission,
} from '@openchoreo/backstage-plugin-react';
import { isForbiddenError, isNotFoundError } from '../../../utils/errorUtils';
import { ChangePipelineDialog } from './ChangePipelineDialog';

function pipelineEntityRefToUrl(
  entityRef: string,
  fallbackNamespace = 'default',
): string {
  const colonIndex = entityRef.indexOf(':');
  if (colonIndex === -1) return `/catalog/${fallbackNamespace}/${entityRef}`;
  const kind = entityRef.substring(0, colonIndex);
  const rest = entityRef.substring(colonIndex + 1);
  const slashIndex = rest.indexOf('/');
  if (slashIndex === -1) return `/catalog/${fallbackNamespace}/${kind}/${rest}`;
  const namespace = rest.substring(0, slashIndex);
  const name = rest.substring(slashIndex + 1);
  return `/catalog/${namespace}/${kind}/${name}`;
}

export const DeploymentPipelineCard = () => {
  const classes = useProjectOverviewCardStyles();
  const { entity } = useEntity();
  const { data, loading, error, refetch } = useDeploymentPipeline();
  const {
    canUpdate,
    loading: permLoading,
    updateDeniedTooltip,
  } = useProjectUpdatePermission();
  const [dialogOpen, setDialogOpen] = useState(false);

  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '';

  const renderChangeButton = () => {
    if (permLoading) return null;
    if (canUpdate) {
      return (
        <Tooltip title="Change pipeline">
          <IconButton size="small" onClick={() => setDialogOpen(true)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      );
    }
    if (updateDeniedTooltip) {
      return (
        <Tooltip title={updateDeniedTooltip}>
          <span>
            <IconButton size="small" disabled>
              <EditIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      );
    }
    return null;
  };

  const changeButton = renderChangeButton();

  const dialog = (
    <ChangePipelineDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      onSaved={refetch}
      namespaceName={namespaceName}
      projectName={entity.metadata.name}
      currentPipelineName={data?.resourceName}
    />
  );

  // Loading state
  if (loading) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Skeleton variant="text" width={150} height={28} />
        </Box>
        <Box className={classes.content}>
          <Skeleton variant="text" width="100%" height={24} />
          <Skeleton variant="text" width="100%" height={24} />
          <Skeleton variant="text" width="60%" height={24} />
        </Box>
      </Card>
    );
  }

  // Error state
  if (error || !data) {
    if (isForbiddenError(error)) {
      return (
        <Card padding={24} className={classes.card}>
          <ForbiddenState message="You do not have permission to view the deployment pipeline." />
        </Card>
      );
    }
    // No pipeline attached to this project (404)
    if (isNotFoundError(error)) {
      return (
        <Card padding={24} className={classes.card}>
          <Box className={classes.cardHeader}>
            <Typography className={classes.cardTitle}>
              Deployment Pipeline
            </Typography>
            {changeButton}
          </Box>
          <Box className={classes.disabledState}>
            <AccountTreeIcon className={classes.disabledIcon} />
            <Typography variant="body2" color="textSecondary">
              No deployment pipeline attached to this project
            </Typography>
          </Box>
          {dialog}
        </Card>
      );
    }
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Deployment Pipeline
          </Typography>
          {changeButton}
        </Box>
        <Box className={classes.disabledState}>
          <ErrorOutlineIcon className={classes.disabledIcon} />
          <Typography variant="body2" color="error">
            Failed to load pipeline data
          </Typography>
        </Box>
        {dialog}
      </Card>
    );
  }

  // No pipeline state
  if (!data.environments || data.environments.length === 0) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Deployment Pipeline
          </Typography>
          {changeButton}
        </Box>
        <Box className={classes.disabledState}>
          <TimelineIcon className={classes.disabledIcon} />
          <Typography variant="body2">
            No deployment pipeline configured
          </Typography>
        </Box>
        {dialog}
      </Card>
    );
  }

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Deployment Pipeline</Typography>
        <Box style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {changeButton}
          {data.pipelineEntityRef && (
            <Tooltip title="Open in new tab">
              <IconButton
                size="small"
                component="a"
                href={pipelineEntityRefToUrl(
                  data.pipelineEntityRef,
                  entity.metadata.namespace || 'default',
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Box className={classes.content}>
        <Box className={classes.pipelineInfo}>
          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>Pipeline:</Typography>
            {data.pipelineEntityRef ? (
              <Link
                to={pipelineEntityRefToUrl(
                  data.pipelineEntityRef,
                  entity.metadata.namespace || 'default',
                )}
                style={{
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <AccountTreeIcon style={{ fontSize: '1rem' }} color="primary" />
                <Typography
                  color="primary"
                  style={{
                    fontSize: 'inherit',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textDecorationColor: 'transparent',
                    transition: 'text-decoration-color 0.2s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.textDecorationColor =
                      'currentColor';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.textDecorationColor =
                      'transparent';
                  }}
                >
                  {data.name}
                </Typography>
              </Link>
            ) : (
              <Typography className={classes.infoValue}>{data.name}</Typography>
            )}
          </Box>

          <Box>
            <Typography className={classes.infoLabel}>Environments</Typography>
            <Box style={{ marginTop: '8px' }}>
              <PipelineFlowVisualization
                environments={data.environments}
                pipelineEntityRef={data.pipelineEntityRef}
                environmentNamespace={entity.metadata.namespace || 'default'}
              />
            </Box>
          </Box>

          {data.dataPlane && (
            <Box className={classes.infoRow}>
              <Typography className={classes.infoLabel}>Data Plane:</Typography>
              <Typography className={classes.infoValue}>
                {data.dataPlane}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
      {dialog}
    </Card>
  );
};
