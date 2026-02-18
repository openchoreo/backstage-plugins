import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  toggleContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing(2),
  },
  toggleButton: {
    textTransform: 'none',
    padding: theme.spacing(0.5, 2),
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
