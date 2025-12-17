import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(3),
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  searchField: {
    width: 300,
  },
  listContainer: {
    marginTop: theme.spacing(2),
  },
  groupHeader: {
    backgroundColor: theme.palette.background.default,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  groupTitle: {
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  actionItem: {
    paddingLeft: theme.spacing(4),
    borderLeft: `2px solid ${theme.palette.divider}`,
    marginLeft: theme.spacing(2),
  },
  actionText: {
    fontFamily: 'monospace',
    fontSize: '0.9rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
  },
  description: {
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
}));
