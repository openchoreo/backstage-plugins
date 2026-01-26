import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  // Deletion badge
  deletionBadge: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.main,
    borderColor: theme.palette.warning.main,
    fontWeight: 600,
    fontSize: '0.7rem',
    height: 20,
  },
  deleteDialogContent: {
    paddingTop: theme.spacing(1),
  },
  entityName: {
    fontWeight: 600,
  },
  warningText: {
    marginTop: theme.spacing(2),
    color: theme.palette.warning.dark,
  },
  deleteButton: {
    // backgroundColor: theme.palette.error.main,
    color: theme.palette.error.main,
    borderColor: theme.palette.error.main,
    '&:hover': {
      backgroundColor: theme.palette.error.light,
    },
  },

  // Table row styling for entities marked for deletion
  deletingRow: {
    opacity: 0.6,
    backgroundColor: `${theme.palette.error.light}10`,
  },
  deletingName: {
    color: theme.palette.text.disabled,
    textDecoration: 'none',
    cursor: 'default',
    '&:hover': {
      textDecoration: 'none',
    },
  },
  nameWithBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
}));
