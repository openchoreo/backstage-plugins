import type { FC } from 'react';
import { Box, Chip, Tooltip, Typography } from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import StorageIcon from '@material-ui/icons/Storage';
import type { ResourceDependency } from '@openchoreo/backstage-plugin-common';

const useStyles = makeStyles((theme: Theme) => ({
  container: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  ref: {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
  },
  chip: {
    height: 20,
    fontSize: '0.7rem',
  },
  bindings: {
    marginTop: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
  },
  bindingsTitle: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: theme.spacing(0.75),
  },
  bindingRow: {
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
    paddingLeft: theme.spacing(1),
  },
  empty: {
    fontSize: '0.8rem',
    color: theme.palette.text.hint,
    fontStyle: 'italic',
    paddingLeft: theme.spacing(1),
  },
  arrow: {
    margin: theme.spacing(0, 0.5),
    color: theme.palette.text.hint,
  },
}));

export interface ResourceDependencyDisplayProps {
  /** The resource dependency to display */
  dependency: ResourceDependency;
}

/**
 * Read-only display for a `Workload.spec.dependencies.resources[]` entry.
 * Shows the referenced Resource name, a `Resource` type chip, and the
 * declared envBindings / fileBindings. Editing happens via YAML or via
 * the dedicated resource-dependency editor (planned, not yet shipped).
 */
export const ResourceDependencyDisplay: FC<ResourceDependencyDisplayProps> = ({
  dependency,
}) => {
  const classes = useStyles();
  const envEntries = Object.entries(dependency.envBindings ?? {});
  const fileEntries = Object.entries(dependency.fileBindings ?? {});

  return (
    <Box className={classes.container} data-testid="resource-dependency-row">
      <Box className={classes.header}>
        <StorageIcon fontSize="small" color="action" />
        <Typography className={classes.ref}>{dependency.ref}</Typography>
        <Tooltip title="Resource dependency. Edit via YAML.">
          <Chip
            label="Resource"
            size="small"
            variant="outlined"
            className={classes.chip}
          />
        </Tooltip>
      </Box>

      <Box className={classes.bindings}>
        <Typography className={classes.bindingsTitle}>
          Env bindings ({envEntries.length})
        </Typography>
        {envEntries.length === 0 ? (
          <Typography className={classes.empty}>None</Typography>
        ) : (
          envEntries.map(([output, target]) => (
            <Typography key={output} className={classes.bindingRow}>
              {output}
              <span className={classes.arrow}>→</span>
              {target}
            </Typography>
          ))
        )}

        <Typography className={classes.bindingsTitle}>
          File bindings ({fileEntries.length})
        </Typography>
        {fileEntries.length === 0 ? (
          <Typography className={classes.empty}>None</Typography>
        ) : (
          fileEntries.map(([output, target]) => (
            <Typography key={output} className={classes.bindingRow}>
              {output}
              <span className={classes.arrow}>→</span>
              {target}
            </Typography>
          ))
        )}
      </Box>
    </Box>
  );
};
