import { makeStyles } from '@material-ui/core/styles';
import { PropsWithChildren } from 'react';

const MAX_WIDTH = 900;

const useStyles = makeStyles({
  root: {
    // Constrain the InfoCard (MuiCard) inside the Content area on the
    // scaffolder wizard page. The header banner keeps its full width.
    // Use attribute selectors to match both dev ("BackstageContent-root")
    // and prod ("jss4-BackstageContent-root") class name formats.
    '& [class*="BackstageContent-root"] > [class*="MuiCard-root"]': {
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
