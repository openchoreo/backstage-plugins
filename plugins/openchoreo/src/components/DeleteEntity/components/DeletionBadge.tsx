import { Chip } from '@material-ui/core';
import { useStyles } from '../styles';

/**
 * Badge component that indicates an entity is marked for deletion.
 */
export function DeletionBadge() {
  const classes = useStyles();

  return (
    <Chip
      label="Marked for Deletion"
      size="small"
      variant="outlined"
      className={classes.deletionBadge}
    />
  );
}
