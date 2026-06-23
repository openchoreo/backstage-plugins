import { makeStyles, Theme } from '@material-ui/core/styles';

export const useStyles = makeStyles((theme: Theme) => ({
  // Footer action bar: full-width, separated from the form body above by a
  // top border, with destructive action pushed left and primary actions right.
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
    paddingTop: theme.spacing(1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  primaryActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginLeft: 'auto',
  },
}));
