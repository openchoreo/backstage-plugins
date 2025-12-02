import type { FC } from 'react';
import { Box, Typography } from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import type { StatusCounts } from '../../utils/overrideGroupUtils';

export interface StatusSummaryBarProps {
  /** Counts for each status category */
  counts: StatusCounts;
}

const useStyles = makeStyles((theme: Theme) => ({
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1, 0),
    marginBottom: theme.spacing(1.5),
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  overriddenDot: {
    backgroundColor: theme.palette.info.main,
  },
  newDot: {
    backgroundColor: theme.palette.success.main,
  },
  inheritedDot: {
    backgroundColor: theme.palette.grey[400],
  },
  text: {
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
  },
  separator: {
    color: theme.palette.grey[400],
    fontSize: '0.8rem',
  },
}));

/**
 * A summary bar showing counts for each override status category.
 * Displays: "● 2 overridden · ● 1 new · ● 3 inherited"
 * Only shows categories that have at least one item.
 */
export const StatusSummaryBar: FC<StatusSummaryBarProps> = ({ counts }) => {
  const classes = useStyles();

  const items: Array<{
    key: string;
    count: number;
    label: string;
    dotClass: string;
  }> = [];

  if (counts.overridden > 0) {
    items.push({
      key: 'overridden',
      count: counts.overridden,
      label: 'overridden',
      dotClass: classes.overriddenDot,
    });
  }

  if (counts.new > 0) {
    items.push({
      key: 'new',
      count: counts.new,
      label: 'new',
      dotClass: classes.newDot,
    });
  }

  if (counts.inherited > 0) {
    items.push({
      key: 'inherited',
      count: counts.inherited,
      label: 'inherited',
      dotClass: classes.inheritedDot,
    });
  }

  // Don't render if no items
  if (items.length === 0) {
    return null;
  }

  return (
    <Box className={classes.container}>
      {items.map((item, index) => (
        <Box key={item.key} className={classes.statusItem}>
          {index > 0 && (
            <Typography component="span" className={classes.separator}>
              ·
            </Typography>
          )}
          <span className={`${classes.dot} ${item.dotClass}`} />
          <Typography component="span" className={classes.text}>
            {item.count} {item.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};
