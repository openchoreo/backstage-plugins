import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  toggleContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing(2),
  },
  formContainer: {
    width: '100%',
  },
  yamlContainer: {
    width: '100%',
    height: 500,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
  errorText: {
    color: theme.palette.error.main,
    marginTop: theme.spacing(1),
    fontSize: '0.75rem',
  },
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
  section: {
    marginTop: theme.spacing(2),
  },
  // "Overridable by a binding" sits snug under the Expression field.
  overridableLabel: {
    marginTop: theme.spacing(0.5),
    marginLeft: 0,
    marginBottom: 0,
  },
  overridableCheckbox: {
    padding: theme.spacing(0.25, 0.75, 0.25, 0),
  },
  parameterCard: {
    marginBottom: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.default,
  },
  parameterHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  addButton: {
    marginTop: theme.spacing(1),
  },
  removeButton: {
    color: theme.palette.text.secondary,
  },
  contextPaths: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    whiteSpace: 'pre-wrap',
    color: theme.palette.text.secondary,
  },
  warningText: {
    color: theme.palette.warning.dark,
    fontSize: '0.75rem',
  },
}));
