import { Fragment } from 'react';
import { List, ListItem, ListItemText, Divider } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { FormattedText } from '../FormattedText';
import type { ObservabilityComponents } from '@openchoreo/backstage-plugin-common';

type Action = ObservabilityComponents['schemas']['Action'];

interface VisibilityImprovementsSectionProps {
  recommendations?: Action[];
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
    fontSize: theme.typography.body1.fontSize,
    color: theme.palette.text.primary,
  },
  secondary: {
    fontSize: theme.typography.caption.fontSize,
  },
}));

export const VisibilityImprovementsSection = ({
  recommendations,
}: VisibilityImprovementsSectionProps) => {
  const classes = useStyles();

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <List className={classes.list} disablePadding>
      {recommendations.map((recommendation, idx) => (
        <Fragment key={idx}>
          <ListItem className={classes.listItem} disableGutters>
            <ListItemText
              primary={
                <FormattedText text={recommendation.description || ''} />
              }
              secondary={
                recommendation.rationale ? (
                  <FormattedText text={recommendation.rationale} />
                ) : undefined
              }
              classes={{
                primary: classes.primary,
                secondary: classes.secondary,
              }}
            />
          </ListItem>
          {idx < recommendations.length - 1 && <Divider component="li" />}
        </Fragment>
      ))}
    </List>
  );
};
