import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  dialogContent: {
    minWidth: 400,
    paddingTop: theme.spacing(2),
  },
  helperText: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
}));
