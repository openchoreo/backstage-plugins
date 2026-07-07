import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Skeleton } from '@openchoreo/backstage-design-system';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(1, 0),
  },
  filterBar: {
    display: 'flex',
    gap: theme.spacing(2),
  },
}));

/**
 * A stable, page-shaped placeholder for the observability pages while the
 * permission check resolves. Replaces the bare `<Progress />` top-bar gate so
 * the page frame doesn't visibly swap when the check completes.
 */
export const ObservabilityPageSkeleton = () => {
  const classes = useStyles();
  return (
    <Box className={classes.root} role="status" aria-busy="true">
      {/* filter bar */}
      <Box className={classes.filterBar}>
        <Skeleton variant="rect" width={220} height={40} />
        <Skeleton variant="rect" width={160} height={40} />
        <Skeleton variant="rect" width={120} height={40} />
      </Box>
      {/* table / content area */}
      <Skeleton variant="rect" width="100%" height={360} />
    </Box>
  );
};
