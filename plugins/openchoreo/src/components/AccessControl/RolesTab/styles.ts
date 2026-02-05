import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  searchField: {
    width: 300,
    marginBottom: theme.spacing(2),
  },
  tableContainer: {
    marginTop: theme.spacing(2),
  },
  actionsChip: {
    margin: theme.spacing(0.25),
    maxWidth: 150,
  },
  actionsCell: {
    maxWidth: 400,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
  },
  deleteButton: {
    borderColor: theme.palette.error.main,
    color: theme.palette.error.main,
    '&:hover': {
      borderColor: theme.palette.error.dark,
      backgroundColor: 'rgba(211, 47, 47, 0.04)',
    },
  },
  warningHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  warningIcon: {
    color: theme.palette.warning.main,
  },
  mappingsList: {
    maxHeight: 200,
    overflow: 'auto',
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(2),
  },
}));
