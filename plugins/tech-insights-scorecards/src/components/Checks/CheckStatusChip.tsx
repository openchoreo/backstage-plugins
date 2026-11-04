import Box from '@material-ui/core/Box';
import Tooltip from '@material-ui/core/Tooltip';
import { makeStyles, Theme } from '@material-ui/core/styles';
import type { CheckStatus } from '../../api/types';

/*
 * The same pill as OpenChoreo's StatusBadge (padding, type size, leading dot,
 * palette light/dark pair), built from the MUI theme alone since this
 * package can't depend on a host design system.
 */
const useStyles = makeStyles((theme: Theme) => ({
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.spacing(2),
    fontSize: '0.875rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  published: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
    '& $dot': { backgroundColor: theme.palette.success.main },
  },
  draft: {
    backgroundColor: theme.palette.secondary.light,
    color: theme.palette.secondary.main,
    '& $dot': { backgroundColor: theme.palette.secondary.main },
  },
}));

export function CheckStatusChip({ status }: { status?: CheckStatus }) {
  const classes = useStyles();
  const published = status === 'published';
  return (
    <Tooltip
      title={
        published ? 'Evaluated in scores' : 'Not evaluated until published'
      }
    >
      <Box
        component="span"
        className={`${classes.badge} ${
          published ? classes.published : classes.draft
        }`}
      >
        <span className={classes.dot} />
        {published ? 'Published' : 'Draft'}
      </Box>
    </Tooltip>
  );
}
