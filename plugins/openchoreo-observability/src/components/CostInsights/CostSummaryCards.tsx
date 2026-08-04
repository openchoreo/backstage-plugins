import { FC } from 'react';
import { Grid, Typography, makeStyles } from '@material-ui/core';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import { Card } from '@openchoreo/backstage-design-system';
import type { CostSummary } from './types';
import { formatUsd, formatEfficiency } from './format';

const useStyles = makeStyles(theme => ({
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
  label: {
    fontWeight: 600,
    fontSize: theme.typography.h6.fontSize,
    color: theme.palette.text.primary,
  },
  value: { fontWeight: 700 },
  delta: { display: 'inline-flex', alignItems: 'center', gap: 2 },
  up: { color: theme.palette.error.main },
  down: { color: theme.palette.success.main },
  deltaIcon: { fontSize: 16 },
  muted: { color: theme.palette.text.secondary },
}));

export interface CostSummaryCardsProps {
  summary: CostSummary;
}

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

export const CostSummaryCards: FC<CostSummaryCardsProps> = ({ summary }) => {
  const classes = useStyles();
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={4}>
        <Card padding={16} className={classes.card}>
          <Typography className={classes.label}>Total Cost</Typography>
          <Typography variant="h5" className={classes.value}>
            {formatUsd(summary.totalCost)}
          </Typography>
          <DeltaChip deltaPct={summary.deltaPct} />
        </Card>
      </Grid>
      <Grid item xs={12} sm={4}>
        <Card padding={16} className={classes.card}>
          <Typography className={classes.label}>Forecast this month</Typography>
          <Typography variant="h5" className={classes.value}>
            {formatUsd(summary.forecastThisMonth)}
          </Typography>
          <Typography variant="body2" className={classes.muted}>
            at current rate
          </Typography>
        </Card>
      </Grid>
      <Grid item xs={12} sm={4}>
        <Card padding={16} className={classes.card}>
          <Typography className={classes.label}>Efficiency</Typography>
          <Typography variant="h5" className={classes.value}>
            {formatEfficiency(summary.efficiency)}
          </Typography>
        </Card>
      </Grid>
    </Grid>
  );
};
