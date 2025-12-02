import { useState, type FC, type ReactNode } from 'react';
import { Box, Typography, IconButton, Collapse, Chip } from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';

export type GroupedSectionStatus = 'overridden' | 'new' | 'inherited';

export interface GroupedSectionProps {
  /** Section title */
  title: string;
  /** Number of items in section */
  count: number;
  /** Status type for color accent */
  status: GroupedSectionStatus;
  /** Whether section is expanded by default */
  defaultExpanded?: boolean;
  /** Content to render when expanded */
  children: ReactNode;
}

const useStyles = makeStyles((theme: Theme) => ({
  container: {
    marginBottom: theme.spacing(2),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    cursor: 'pointer',
    padding: theme.spacing(0.5, 0),
    '&:hover': {
      opacity: 0.8,
    },
  },
  accentBar: {
    width: 3,
    height: 20,
    borderRadius: 2,
  },
  overriddenAccent: {
    backgroundColor: theme.palette.info.main,
  },
  newAccent: {
    backgroundColor: theme.palette.success.main,
  },
  inheritedAccent: {
    backgroundColor: theme.palette.grey[400],
  },
  title: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  countChip: {
    height: 20,
    fontSize: '0.7rem',
    fontWeight: 500,
  },
  overriddenChip: {
    backgroundColor: theme.palette.info.light,
    color: theme.palette.info.contrastText,
  },
  newChip: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.contrastText,
  },
  inheritedChip: {
    backgroundColor: theme.palette.grey[300],
    color: theme.palette.grey[700],
  },
  expandButton: {
    padding: 4,
    marginLeft: 'auto',
  },
  expandIcon: {
    fontSize: '1.2rem',
    color: theme.palette.text.secondary,
  },
  content: {
    paddingLeft: theme.spacing(1.5),
    paddingTop: theme.spacing(1),
  },
}));

const statusTitles: Record<GroupedSectionStatus, string> = {
  overridden: 'Overrides',
  new: 'New',
  inherited: 'Inherited',
};

/**
 * A collapsible section for grouping items by status.
 * Shows a header with colored accent, title, count badge, and expand/collapse toggle.
 */
export const GroupedSection: FC<GroupedSectionProps> = ({
  title,
  count,
  status,
  defaultExpanded = true,
  children,
}) => {
  const classes = useStyles();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const displayTitle = title || statusTitles[status];

  const getAccentClass = () => {
    switch (status) {
      case 'overridden':
        return classes.overriddenAccent;
      case 'new':
        return classes.newAccent;
      default:
        return classes.inheritedAccent;
    }
  };

  const getChipClass = () => {
    switch (status) {
      case 'overridden':
        return classes.overriddenChip;
      case 'new':
        return classes.newChip;
      default:
        return classes.inheritedChip;
    }
  };

  const handleToggle = () => {
    setExpanded(prev => !prev);
  };

  return (
    <Box className={classes.container}>
      <Box className={classes.header} onClick={handleToggle}>
        <span className={`${classes.accentBar} ${getAccentClass()}`} />
        <Typography className={classes.title}>{displayTitle}</Typography>
        <Chip
          label={count}
          size="small"
          className={`${classes.countChip} ${getChipClass()}`}
        />
        <IconButton
          className={classes.expandButton}
          size="small"
          onClick={e => {
            e.stopPropagation();
            handleToggle();
          }}
        >
          {expanded ? (
            <ExpandLessIcon className={classes.expandIcon} />
          ) : (
            <ExpandMoreIcon className={classes.expandIcon} />
          )}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Box className={classes.content}>{children}</Box>
      </Collapse>
    </Box>
  );
};
