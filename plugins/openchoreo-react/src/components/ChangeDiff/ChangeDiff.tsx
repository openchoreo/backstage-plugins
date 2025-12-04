import { type FC } from 'react';
import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Change, formatChangeValue } from '../../utils/changeDetection';

const useStyles = makeStyles(theme => ({
  container: {
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    padding: theme.spacing(0.5, 0),
  },
  path: {
    fontWeight: 'bold',
    marginRight: theme.spacing(0.5),
  },
  new: {
    color: theme.palette.success.main,
  },
  modified: {
    color: theme.palette.warning.main,
  },
  removed: {
    color: theme.palette.error.main,
  },
  label: {
    color: theme.palette.text.secondary,
    marginRight: theme.spacing(0.5),
  },
  arrow: {
    margin: theme.spacing(0, 0.5),
    color: theme.palette.text.secondary,
  },
  value: {
    wordBreak: 'break-word',
  },
}));

export interface ChangeDiffProps {
  /** The change to display */
  change: Change;
  /** Whether to show the path prefix */
  showPath?: boolean;
}

/**
 * Component for displaying a single change with proper formatting.
 * Shows the path, change type, and old/new values in an inline expanded format.
 *
 * @example
 * ```tsx
 * <ChangeDiff
 *   change={{ path: 'config.replicas', type: 'modified', oldValue: 2, newValue: 3 }}
 * />
 * // Renders: config.replicas: 2 → 3
 * ```
 */
export const ChangeDiff: FC<ChangeDiffProps> = ({
  change,
  showPath = true,
}) => {
  const classes = useStyles();

  const renderValue = (value: unknown) => (
    <span className={classes.value}>{formatChangeValue(value)}</span>
  );

  const getTypeClass = () => {
    switch (change.type) {
      case 'new':
        return classes.new;
      case 'modified':
        return classes.modified;
      case 'removed':
        return classes.removed;
      default:
        return '';
    }
  };

  return (
    <Box className={classes.container}>
      <Typography component="span" className={getTypeClass()}>
        {showPath && <span className={classes.path}>{change.path}:</span>}
        {change.type === 'new' && (
          <>
            <span className={classes.label}>[New]</span>
            {renderValue(change.newValue)}
          </>
        )}
        {change.type === 'modified' && (
          <>
            {renderValue(change.oldValue)}
            <span className={classes.arrow}>→</span>
            {renderValue(change.newValue)}
          </>
        )}
        {change.type === 'removed' && (
          <>
            <span className={classes.label}>[Removed]</span>
            {renderValue(change.oldValue)}
          </>
        )}
      </Typography>
    </Box>
  );
};
