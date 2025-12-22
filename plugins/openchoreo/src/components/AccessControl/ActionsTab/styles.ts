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
    backgroundColor: theme.palette.common.white,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    boxShadow: 'none',
  },
  groupHeader: {
    padding: theme.spacing(2, 3),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:hover': {
      backgroundColor: 'transparent',
    },
  },
  groupTitle: {
    fontWeight: 600,
    textTransform: 'capitalize',
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
  },
  actionCount: {
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  expandIcon: {
    color: theme.palette.text.secondary,
  },
  collapseContent: {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  actionItem: {
    paddingLeft: theme.spacing(6),
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  actionText: {
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    textTransform: 'lowercase',
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
