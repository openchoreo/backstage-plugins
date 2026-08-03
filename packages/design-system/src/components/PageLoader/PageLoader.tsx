import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Spinner } from '../Spinner';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // Fill a flex parent when one constrains the height, and otherwise fall
    // back to the viewport-relative `minHeight` so the spinner sits in the
    // middle of the visible page rather than hugging the top.
    flexGrow: 1,
    width: '100%',
    height: '100%',
    padding: theme.spacing(4),
  },
}));

export interface PageLoaderProps {
  /**
   * Minimum height of the loader area. Defaults to a viewport fraction so the
   * spinner is vertically centered on a full page; pass a smaller value for a
   * section/in-card loader.
   */
  minHeight?: string | number;
}

/**
 * Centered circular loader for page / route / section loads whose content
 * shape isn't known yet (replaces the Backstage `<Progress />` bar). For
 * first-load placeholders of a known shape use `Skeleton` instead.
 */
export const PageLoader = ({ minHeight = '60vh' }: PageLoaderProps) => {
  const classes = useStyles();
  return (
    <Box className={classes.root} style={{ minHeight }} role="status" aria-busy>
      <Spinner size="page" aria-label="Loading" />
    </Box>
  );
};
