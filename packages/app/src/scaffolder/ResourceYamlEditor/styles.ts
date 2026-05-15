import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  helpText: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginBottom: theme.spacing(1.5),
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
  helpLink: {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    fontWeight: 500,
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  pickerRow: {
    display: 'flex',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  pickerField: {
    flex: 1,
  },
  paramsBox: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  paramsTitle: {
    fontWeight: 500,
    marginBottom: theme.spacing(1),
  },
  schemaError: {
    color: theme.palette.error.main,
    fontSize: '0.875rem',
    marginBottom: theme.spacing(1),
  },
  emptyState: {
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
    fontStyle: 'italic',
  },
  yamlContainer: {
    width: '100%',
    height: 400,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
  errorText: {
    color: theme.palette.error.main,
    marginTop: theme.spacing(1),
    fontSize: '0.75rem',
  },
}));
