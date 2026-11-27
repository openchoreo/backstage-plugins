import type { ReactNode } from 'react';
import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  Card,
  FormYamlToggle,
  type FormYamlMode,
} from '@openchoreo/backstage-design-system';

/**
 * Spacing and shapes of OpenChoreo's configure pages: one bordered card, a
 * title row with the FORM | YAML toggle, 24px padding, sections 32px apart
 * with a heading and one helper line.
 */
const useStyles = makeStyles(theme => ({
  card: {
    overflow: 'hidden',
  },
  titleRow: {
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0, 1.5, 0, 2.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    flex: 1,
  },
  body: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
  },
  heading: {
    fontSize: 15,
    fontWeight: 600,
  },
  helper: {
    marginTop: theme.spacing(0.5),
  },
  content: {
    marginTop: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
}));

/** A configure card: a title, the FORM | YAML toggle and the body. */
export const TrafficCard = ({
  title,
  mode,
  onModeChange,
  children,
}: {
  title: string;
  mode?: FormYamlMode;
  onModeChange?: (mode: FormYamlMode) => void;
  children: ReactNode;
}) => {
  const classes = useStyles();
  return (
    <Card border elevation={0} className={classes.card}>
      <Box className={classes.titleRow}>
        <Typography className={classes.title}>{title}</Typography>
        {mode && onModeChange && (
          <FormYamlToggle value={mode} onChange={onModeChange} />
        )}
      </Box>
      <Box className={classes.body}>{children}</Box>
    </Card>
  );
};

/** One section of a configure card: a heading, one helper line, then content. */
export const TrafficSection = ({
  heading,
  helper,
  children,
}: {
  heading: string;
  helper?: ReactNode;
  children?: ReactNode;
}) => {
  const classes = useStyles();
  return (
    <Box className={classes.section} component="section" aria-label={heading}>
      <Typography className={classes.heading} component="h3">
        {heading}
      </Typography>
      {helper && (
        <Typography
          variant="body2"
          color="textSecondary"
          className={classes.helper}
        >
          {helper}
        </Typography>
      )}
      {children && <Box className={classes.content}>{children}</Box>}
    </Box>
  );
};
