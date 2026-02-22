import { Fragment } from 'react';
import { List, ListItem, ListItemText, Divider } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { FormattedText } from '../FormattedText';
import type { AIRCAAgentComponents } from '@openchoreo/backstage-plugin-common';

type RecommendedAction = AIRCAAgentComponents['schemas']['RecommendedAction'];

interface RecommendationsSectionProps {
  actions?: RecommendedAction[];
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
    fontWeight: 500,
    fontSize: theme.typography.body1.fontSize,
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
              primary={
                <FormattedText
                  text={action.description || ''}
                  disableMarkdown
                />
              }
              secondary={
                action.rationale ? (
                  <FormattedText text={action.rationale} />
                ) : undefined
              }
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
