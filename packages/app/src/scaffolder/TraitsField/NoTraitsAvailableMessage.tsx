import { Card, CardContent, Link, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  card: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.primary.main}`,
    backgroundColor: theme.palette.secondary.light,
  },
  heading: {
    color: theme.palette.primary.dark,
    fontWeight: 600,
  },
  link: {
    fontWeight: 500,
  },
}));

export const NoTraitsAvailableMessage = () => {
  const classes = useStyles();

  return (
    <Card variant="outlined" className={classes.card}>
      <CardContent>
        <Typography variant="h6" gutterBottom className={classes.heading}>
          No Traits Available for This Namespace
        </Typography>
        <Typography variant="body2" paragraph>
          Traits are cross-cutting capabilities that extend components without
          modifying their core definitions. Add persistent storage,
          observability, security policies, or service mesh integration to your
          components.
        </Typography>
        <Typography variant="body2" paragraph>
          Platform engineers can create traits to provide these capabilities.
          Once created, they'll appear here for selection.
        </Typography>
        <Link
          href="https://openchoreo.dev/docs/next/reference/api/platform/trait/"
          target="_blank"
          rel="noopener noreferrer"
          variant="body2"
          className={classes.link}
        >
          Learn how to create traits →
        </Link>
      </CardContent>
    </Card>
  );
};
