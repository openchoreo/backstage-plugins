import { makeStyles, Theme } from '@material-ui/core/styles';

export const useStyles = makeStyles((theme: Theme) => ({
  // Footer action bar: full-width, separated from the form body above by a
  // top border, with all actions grouped on the right (see primaryActions).
  footer: {
    display: 'flex',
    alignItems: 'center',
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
  // Read-only inline action group: Edit + Delete sit on the same line as the
  // row content, grouped to the right. No divider/top-margin (that's the footer).
  inlineActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginLeft: theme.spacing(1),
    flexShrink: 0,
  },
}));
