import { Fragment } from 'react';
import { List, ListItem, ListItemText, Divider } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import type { ObservabilityComponents } from '@openchoreo/backstage-plugin-common';

type ExcludedCause = ObservabilityComponents['schemas']['ExcludedCause'];

interface ExcludedCausesSectionProps {
  excludedCauses?: ExcludedCause[];
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

export const ExcludedCausesSection = ({
  excludedCauses,
}: ExcludedCausesSectionProps) => {
  const classes = useStyles();

  if (!excludedCauses || excludedCauses.length === 0) {
    return null;
  }

  return (
    <List className={classes.list} disablePadding>
      {excludedCauses.map((cause, idx) => (
        <Fragment key={idx}>
          <ListItem className={classes.listItem} disableGutters>
            <ListItemText
              primary={cause.description}
              secondary={cause.reason}
              classes={{
                primary: classes.primary,
                secondary: classes.secondary,
              }}
            />
          </ListItem>
          {idx < excludedCauses.length - 1 && <Divider component="li" />}
        </Fragment>
      ))}
    </List>
  );
};
