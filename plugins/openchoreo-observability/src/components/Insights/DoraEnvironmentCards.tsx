import { Card, CardContent, Grid, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { DoraBreakdownRow } from './useDoraBreakdown';
import { formatDurationMs, formatPercent } from './utils';

const useStyles = makeStyles(theme => ({
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  pin: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flex: 'none',
  },
  name: {
    fontWeight: 600,
  },
  metricLabel: {
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontSize: 10,
    color: theme.palette.text.secondary,
  },
  metricValue: {
    fontWeight: 650,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 17,
  },
}));

// Wireframe pin colors: production red, staging amber, everything else green.
function pinColor(env: string): string {
  const name = env.toLowerCase();
  if (name.startsWith('prod')) {
    return '#d03b3b';
  }
  if (name.startsWith('stag')) {
    return '#fab219';
  }
  return '#0ca30c';
}

export interface DoraEnvironmentCardsProps {
  /** One row per environment (scope.environment set), from useDoraBreakdown. */
  rows: DoraBreakdownRow[];
}

/**
 * The wireframe's "Per environment" section: one card per environment with the
 * four DORA numbers for the current scope sliced to that environment.
 */
export const DoraEnvironmentCards = ({ rows }: DoraEnvironmentCardsProps) => {
  const classes = useStyles();

  if (rows.length === 0) {
    return null;
  }

  return (
    <Grid container spacing={2}>
      {rows.map(row => {
        const s = row.summary;
        const metrics = [
          {
            label: 'Deploys',
            value: s?.deploymentFrequency
              ? `${s.deploymentFrequency.total}`
              : '—',
          },
          { label: 'Lead time p50', value: formatDurationMs(s?.leadTime?.p50Ms) },
          {
            label: 'Change failure',
            value:
              s?.changeFailureRate && s.changeFailureRate.total > 0
                ? formatPercent(s.changeFailureRate.rate)
                : '—',
          },
          { label: 'MTTR', value: formatDurationMs(s?.mttr?.meanMs) },
        ];
        return (
          <Grid item xs={12} md={4} key={row.name}>
            <Card variant="outlined">
              <CardContent>
                <div className={classes.header}>
                  <span
                    className={classes.pin}
                    style={{ background: pinColor(row.name) }}
                  />
                  <Typography variant="body1" className={classes.name}>
                    {row.name}
                  </Typography>
                </div>
                <Grid container spacing={1}>
                  {metrics.map(metric => (
                    <Grid item xs={6} key={metric.label}>
                      <Typography className={classes.metricLabel}>
                        {metric.label}
                      </Typography>
                      <Typography className={classes.metricValue}>
                        {metric.value}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
};
