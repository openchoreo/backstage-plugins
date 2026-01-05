import { Box, Divider, List, ListItem, ListItemText } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { FormattedText } from '../FormattedText';

interface VisibilityImprovementsSectionProps {
  improvements?: string[];
}

const useStyles = makeStyles(theme => ({
  list: {
    padding: 0,
  },
  listItem: {
    paddingLeft: 0,
    paddingRight: 0,
  },
  primary: {
    fontWeight: 600,
    fontSize: theme.typography.body1.fontSize,
    color: theme.palette.text.primary,
  },
}));

export const VisibilityImprovementsSection = ({
  improvements,
}: VisibilityImprovementsSectionProps) => {
  const classes = useStyles();

  if (!improvements || improvements.length === 0) {
    return null;
  }

  return (
    <List className={classes.list}>
      {improvements.map((improvement, idx) => (
        <Box key={idx}>
          <ListItem className={classes.listItem}>
            <ListItemText
              primary={<FormattedText text={improvement} />}
              classes={{ primary: classes.primary }}
            />
          </ListItem>
          {idx < improvements.length - 1 && <Divider />}
        </Box>
      ))}
    </List>
  );
};
