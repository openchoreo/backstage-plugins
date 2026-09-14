import { FC } from 'react';
import { Typography, makeStyles } from '@material-ui/core';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import type { CostSummary } from './types';
import { formatUsd } from './format';

const useStyles = makeStyles(theme => ({
  label: {
    fontWeight: 600,
    fontSize: '0.75rem',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  value: {
    fontWeight: 700,
    fontSize: '1.5rem',
    lineHeight: 1.1,
    color: theme.palette.text.primary,
  },
  valueDense: { fontSize: '1.15rem' },
  delta: { display: 'inline-flex', alignItems: 'center', gap: 2 },
  up: { color: theme.palette.error.main },
  down: { color: theme.palette.success.main },
  deltaIcon: { fontSize: 16 },
  muted: { color: theme.palette.text.secondary },
}));

const DeltaChip: FC<{ deltaPct: number | null }> = ({ deltaPct }) => {
  const classes = useStyles();
  if (deltaPct === null || !Number.isFinite(deltaPct)) {
    return (
      <Typography variant="body2" className={classes.muted}>
        No previous window
      </Typography>
    );
  }
  const rounded = Math.round(deltaPct);
  const up = rounded > 0;
  const down = rounded < 0;
  return (
    <Typography
      variant="body2"
      component="span"
      className={`${classes.delta} ${up ? classes.up : ''} ${
        down ? classes.down : ''
      }`}
    >
      {up && <ArrowUpwardIcon className={classes.deltaIcon} />}
      {down && <ArrowDownwardIcon className={classes.deltaIcon} />}
      {`${Math.abs(rounded)}% vs prev window`}
    </Typography>
  );
};

/**
 * The Total Cost card's inner content (label, headline value, delta), without a
 * `Card` wrapper — so the catalog overview's cost summary card can render it
 * without nesting one `Card` inside another.
 */
export const TotalCostContent: FC<{
  summary: CostSummary;
  dense?: boolean;
}> = ({ summary, dense }) => {
  const classes = useStyles();
  return (
    <>
      <Typography className={classes.label}>Total Cost</Typography>
      <Typography
        component="div"
        className={`${classes.value} ${dense ? classes.valueDense : ''}`}
      >
        {formatUsd(summary.totalCost)}
      </Typography>
      <DeltaChip deltaPct={summary.deltaPct} />
    </>
  );
};
