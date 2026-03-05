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
  container: {
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
}));
