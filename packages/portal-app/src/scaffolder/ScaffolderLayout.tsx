import { makeStyles } from '@material-ui/core/styles';
import { PropsWithChildren } from 'react';

const MAX_WIDTH = 900;

const useStyles = makeStyles({
  root: {
    // Constrain the InfoCard (MuiCard) inside the Content area on the
    // scaffolder wizard page. The header banner keeps its full width.
    // Target <article> directly since BackstageContent renders as <article>
    // and its class name is mangled in production (jss4-XXXX).
    '& article > [class*="MuiCard-root"]': {
      maxWidth: MAX_WIDTH,
      marginLeft: 'auto',
      marginRight: 'auto',
    },
  },
});

export function ScaffolderLayout({ children }: PropsWithChildren<{}>) {
  const classes = useStyles();
  return <div className={classes.root}>{children}</div>;
}
