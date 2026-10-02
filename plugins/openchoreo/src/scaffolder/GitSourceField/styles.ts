import { makeStyles } from '@material-ui/core';

export const useRepoCreationStyles = makeStyles(theme => ({
  toggle: {
    marginBottom: theme.spacing(2),
  },
  hint: {
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
}));
