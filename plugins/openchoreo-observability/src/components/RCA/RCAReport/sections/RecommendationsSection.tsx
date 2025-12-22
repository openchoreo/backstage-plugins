import { Fragment } from 'react';
import { List, ListItem, ListItemText, Divider } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import type { ObservabilityComponents } from '@openchoreo/backstage-plugin-common';

type Action = ObservabilityComponents['schemas']['Action'];

interface RecommendationsSectionProps {
  actions?: Action[];
}

const useStyles = makeStyles(theme => ({
  list: {
    padding: 0,
    margin: 0,
  },
  listItem: {
    padding: theme.spacing(1, 0),
  },
  primary: {
    fontWeight: 600,
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
  },
  secondary: {
    fontSize: theme.typography.caption.fontSize,
  },
}));

export const RecommendationsSection = ({
  actions,
}: RecommendationsSectionProps) => {
  const classes = useStyles();

  if (!actions || actions.length === 0) {
    return null;
  }

  return (
    <List className={classes.list} disablePadding>
      {actions.map((action, idx) => (
        <Fragment key={idx}>
          <ListItem className={classes.listItem} disableGutters>
            <ListItemText
              primary={action.description}
              secondary={action.rationale}
              classes={{
                primary: classes.primary,
                secondary: classes.secondary,
              }}
            />
          </ListItem>
          {idx < actions.length - 1 && <Divider component="li" />}
        </Fragment>
      ))}
    </List>
  );
};
