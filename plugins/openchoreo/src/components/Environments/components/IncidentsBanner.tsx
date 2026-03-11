import { Box, Link, Tooltip, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import WarningIcon from '@material-ui/icons/Warning';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

const useStyles = makeStyles(theme => ({
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.palette.warning.light,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1, 1.5),
    marginTop: theme.spacing(2),
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  icon: {
    color: theme.palette.warning.dark,
    fontSize: '1.2rem',
  },
  text: {
    color: theme.palette.warning.dark,
    fontSize: '0.875rem',
  },
  viewLink: {
    color: theme.palette.warning.dark,
    fontSize: '0.8rem',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
}));

interface IncidentsBannerProps {
  count: number;
  environmentName: string;
}

export const IncidentsBanner = ({
  count,
  environmentName,
}: IncidentsBannerProps) => {
  const classes = useStyles();
  const { entity } = useEntity();

  if (count <= 0) return null;

  const label =
    count === 1 ? '1 Incident detected' : `${count} Incidents detected`;
  const tooltip = `${count} incident${
    count === 1 ? '' : 's'
  } detected during last hour`;
  const namespace = entity.metadata.namespace || 'default';
  const projectName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] ?? '';
  const params = new URLSearchParams({
    env: environmentName.toLowerCase(),
    timeRange: '1h',
    status: 'active',
  });
  const viewUrl = `/catalog/${namespace}/system/${projectName}/incidents?${params.toString()}`;

  return (
    <Tooltip title={tooltip} arrow placement="top">
      <Box className={classes.banner}>
        <Box className={classes.left}>
          <WarningIcon className={classes.icon} />
          <Typography className={classes.text}>{label}</Typography>
        </Box>
        <Link
          href={viewUrl}
          className={classes.viewLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
        >
          View
        </Link>
      </Box>
    </Tooltip>
  );
};
