import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    minHeight: theme.spacing(7.5),
  },
  headerTitle: {
    fontWeight: 600,
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing(1),
  },
  container: {
    height: 'calc(100vh - 240px)',
    display: 'flex',
    flexDirection: 'column',
  },
  notFoundContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    padding: theme.spacing(4),
  },
}));
