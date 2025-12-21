import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  tabNav: {
    height: '100%',
    minHeight: 400,
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
    minHeight: '400px',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    gap: theme.spacing(2),
  },
  errorBanner: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.error.light,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
  },
}));
