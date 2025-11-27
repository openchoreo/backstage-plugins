import { Typography, Box, Grid } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import { BuildStatusChip } from '../BuildStatusChip';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';

const useStyles = makeStyles(theme => ({
  metadataCard: {
    padding: theme.spacing(2),
    backgroundColor: alpha(theme.palette.background.paper, 0.6),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
  },
  propertyRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  propertyKey: {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    minWidth: '120px',
  },
  propertyValue: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.body2.fontSize,
    wordBreak: 'break-word',
  },
  commitValue: {
    fontFamily: 'monospace',
    backgroundColor: alpha(
      theme.palette.type === 'dark'
        ? theme.palette.common.white
        : theme.palette.common.black,
      0.05,
    ),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.spacing(0.5),
  },
}));

interface RunMetadataContentProps {
  build: ModelsBuild;
}

export const RunMetadataContent = ({ build }: RunMetadataContentProps) => {
  const classes = useStyles();

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Box className={classes.metadataCard}>
            <Typography variant="h6" gutterBottom>
              Build Information
            </Typography>

            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>Name:</Typography>
              <Typography className={classes.propertyValue}>
                {build.name || 'N/A'}
              </Typography>
            </Box>

            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>Status:</Typography>
              <BuildStatusChip status={build.status} />
            </Box>

            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>Commit:</Typography>
              <Typography
                className={`${classes.propertyValue} ${classes.commitValue}`}
              >
                {build.commit || 'N/A'}
              </Typography>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box className={classes.metadataCard}>
            <Typography variant="h6" gutterBottom>
              Timestamps
            </Typography>

            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>Created:</Typography>
              <Typography className={classes.propertyValue}>
                {formatDate(build.createdAt)}
              </Typography>
            </Box>

            {build.image && (
              <Box className={classes.propertyRow}>
                <Typography className={classes.propertyKey}>Image:</Typography>
                <Typography
                  className={`${classes.propertyValue} ${classes.commitValue}`}
                >
                  {build.image}
                </Typography>
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};
