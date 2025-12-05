import { Box, Typography, Tooltip } from '@material-ui/core';
import {
  StatusError,
  StatusOK,
  StatusPending,
  StatusRunning,
} from '@backstage/core-components';
import { ComponentWithDeployment } from '../hooks';
import { useProjectComponentsCardStyles } from './styles';

interface BuildStatusCellProps {
  component: ComponentWithDeployment;
}

export const BuildStatusCell = ({ component }: BuildStatusCellProps) => {
  const classes = useProjectComponentsCardStyles();
  const build = component.latestBuild;

  if (!build) {
    return (
      <Typography variant="body2" color="textSecondary">
        -
      </Typography>
    );
  }

  const status = build.status?.toLowerCase() || '';
  let StatusIcon = StatusPending;

  if (status.includes('success') || status.includes('complete')) {
    StatusIcon = StatusOK;
  } else if (status.includes('fail') || status.includes('error')) {
    StatusIcon = StatusError;
  } else if (status.includes('running') || status.includes('progress')) {
    StatusIcon = StatusRunning;
  } else if (status.includes('pending') || status.includes('queued')) {
    StatusIcon = StatusPending;
  }

  const tooltipContent = (
    <Box>
      <Typography variant="body2" className={classes.tooltipBuildName}>
        {build.name}
      </Typography>
      <Typography variant="caption">{build.status}</Typography>
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} arrow>
      <Box className={classes.buildStatus}>
        <StatusIcon />
      </Box>
    </Tooltip>
  );
};
