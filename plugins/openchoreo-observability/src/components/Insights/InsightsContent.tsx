import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import { Alert } from '@material-ui/lab';
import { Progress } from '@backstage/core-components';
import { DoraGranularity, DoraSearchScope } from '../../types';
import { useDoraInsights } from './useDoraInsights';
import { InsightsLevel, useDoraBreakdown } from './useDoraBreakdown';
import { DoraMetricTile } from './DoraMetricTile';
import { DoraTrendChart } from './DoraTrendChart';
import { DoraBreakdownTable } from './DoraBreakdownTable';
import { DoraEnvironmentCards } from './DoraEnvironmentCards';
import { INSIGHTS_TIME_RANGES, formatDurationMs, formatPercent } from './utils';

const CHART_COLORS = {
  deployments: '#1f77b4',
  leadTimeP50: '#2ca02c',
  leadTimeP75: '#66bb6a',
  leadTimeP95: '#98df8a',
  cfr: '#d62728',
  mttr: '#9467bd',
};

const BREAKDOWN_LABELS: Record<
  InsightsLevel,
  { child: string; title: string }
> = {
  domain: { child: 'Project', title: 'Delivery performance by project' },
  system: { child: 'Component', title: 'Delivery performance by component' },
  component: {
    child: 'Environment',
    title: 'Delivery performance by environment',
  },
};

export interface InsightsContentProps {
  /** Resolved query scope; null while the entity context is still loading. */
  scope: DoraSearchScope | null;
  /** Entity level driving breakdown labels and sections; null while loading. */
  level: InsightsLevel | null;
}

/**
 * The Delivery Insights (DORA metrics) surface, per the Insights wireframe:
 * filter bar (range / granularity / environment), four KPI tiles with rating +
 * delta + sparkline, four trend charts, a one-level-down breakdown table, a
 * per-environment section, and a "how these are calculated" footnote. Shared
 * by the namespace, project, and component pages — scope/level are the only
 * differences between them.
 */
export const InsightsContent = ({ scope, level }: InsightsContentProps) => {
  const [rangeDays, setRangeDays] = useState(30);
  const [granularity, setGranularity] = useState<DoraGranularity>('daily');
  const [envFilter, setEnvFilter] = useState('');

  // The environment filter narrows the headline tiles/charts (and the
  // project/component breakdown children inherit it); the per-environment
  // section always shows all environments, so it hides while a filter is on.
  const effectiveScope = useMemo((): DoraSearchScope | null => {
    if (!scope) {
      return null;
    }
    return envFilter ? { ...scope, environment: envFilter } : scope;
  }, [scope, envFilter]);

  const { data, loading, error, refetch } = useDoraInsights(
    effectiveScope,
    rangeDays,
    granularity,
  );
  const breakdown = useDoraBreakdown(
    level,
    level === 'component' ? scope : effectiveScope,
    rangeDays,
  );

  if (!scope || !level) {
    return <Progress />;
  }

  const summary = data?.summary;
  const series = data?.series;
  const frequency = summary?.deploymentFrequency;
  const leadTime = summary?.leadTime;
  const cfr = summary?.changeFailureRate;
  const mttr = summary?.mttr;
  const cmpLabel = `vs prev ${
    INSIGHTS_TIME_RANGES.find(r => r.days === rangeDays)?.label ?? ''
  }`;
  const labels = BREAKDOWN_LABELS[level];

  return (
    <Box>
      <Box display="flex" alignItems="center" style={{ gap: 12 }} mb={2}>
        <TextField
          select
          size="small"
          variant="outlined"
          label="Range"
          value={rangeDays}
          onChange={event => setRangeDays(Number(event.target.value))}
        >
          {INSIGHTS_TIME_RANGES.map(option => (
            <MenuItem key={option.days} value={option.days}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          variant="outlined"
          label="Granularity"
          value={granularity}
          onChange={event =>
            setGranularity(event.target.value as DoraGranularity)
          }
        >
          <MenuItem value="daily">Daily</MenuItem>
          <MenuItem value="weekly">Weekly</MenuItem>
          <MenuItem value="monthly">Monthly</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          variant="outlined"
          label="Env"
          value={envFilter}
          onChange={event => setEnvFilter(event.target.value)}
          style={{ minWidth: 160 }}
        >
          <MenuItem value="">All environments</MenuItem>
          {breakdown.environments.map(env => (
            <MenuItem key={env} value={env}>
              {env}
            </MenuItem>
          ))}
        </TextField>
        <Box flexGrow={1} />
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={refetch}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Box mb={2}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {loading && !data ? (
        <Progress />
      ) : (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <DoraMetricTile
                title="Deployment Frequency"
                value={frequency ? `${frequency.perDay.toFixed(2)}/day` : '—'}
                classification={frequency?.classification ?? 'Unknown'}
                deltaPct={frequency?.deltaPct ?? null}
                positiveDeltaIsGood
                subText={
                  frequency
                    ? `${frequency.total} deployments · ${cmpLabel}`
                    : undefined
                }
                sparkData={series?.deploymentFrequency?.map(p => p.count)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <DoraMetricTile
                title="Lead Time for Changes"
                value={formatDurationMs(leadTime?.p50Ms)}
                classification={leadTime?.classification ?? 'Unknown'}
                deltaPct={leadTime?.deltaPct ?? null}
                positiveDeltaIsGood={false}
                subText={
                  leadTime
                    ? `p50, commit→deploy · ${Math.round(
                        leadTime.coverage * 100,
                      )}% commit coverage`
                    : undefined
                }
                sparkData={series?.leadTime?.map(p => p.p50Ms)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <DoraMetricTile
                title="Change Failure Rate"
                value={cfr ? formatPercent(cfr.rate) : '—'}
                classification={cfr?.classification ?? 'Unknown'}
                deltaPct={cfr?.deltaPct ?? null}
                positiveDeltaIsGood={false}
                subText={
                  cfr ? `${cfr.failed} of ${cfr.total} failed` : undefined
                }
                sparkData={series?.changeFailureRate?.map(p => p.rate)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <DoraMetricTile
                title="Mean Time to Recovery"
                value={formatDurationMs(mttr?.meanMs)}
                classification={mttr?.classification ?? 'Unknown'}
                deltaPct={mttr?.deltaPct ?? null}
                positiveDeltaIsGood={false}
                subText={
                  mttr
                    ? `incident→restore · ${mttr.recoveries} recoveries`
                    : undefined
                }
                sparkData={series?.mttr?.map(p => p.meanMs)}
              />
            </Grid>
          </Grid>

          <Box mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <DoraTrendChart
                  title="Deployments"
                  granularity={granularity}
                  data={series?.deploymentFrequency ?? []}
                  series={[
                    {
                      dataKey: 'count',
                      label: 'Deployments',
                      color: CHART_COLORS.deployments,
                    },
                  ]}
                  variant="bar"
                  valueFormatter={value => `${value}`}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DoraTrendChart
                  title="Lead Time for Changes"
                  granularity={granularity}
                  data={series?.leadTime ?? []}
                  series={[
                    {
                      dataKey: 'p50Ms',
                      label: 'p50',
                      color: CHART_COLORS.leadTimeP50,
                    },
                    {
                      dataKey: 'p75Ms',
                      label: 'p75',
                      color: CHART_COLORS.leadTimeP75,
                    },
                    {
                      dataKey: 'p95Ms',
                      label: 'p95',
                      color: CHART_COLORS.leadTimeP95,
                    },
                  ]}
                  variant="line"
                  valueFormatter={formatDurationMs}
                  emptyMessage="No deployments with commit provenance in the selected window"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DoraTrendChart
                  title="Change Failure Rate"
                  granularity={granularity}
                  data={series?.changeFailureRate ?? []}
                  series={[
                    {
                      dataKey: 'rate',
                      label: 'Failure rate',
                      color: CHART_COLORS.cfr,
                    },
                  ]}
                  variant="line"
                  valueFormatter={value => formatPercent(value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DoraTrendChart
                  title="Mean Time to Recovery"
                  granularity={granularity}
                  data={series?.mttr ?? []}
                  series={[
                    {
                      dataKey: 'meanMs',
                      label: 'MTTR',
                      color: CHART_COLORS.mttr,
                    },
                  ]}
                  variant="line"
                  valueFormatter={formatDurationMs}
                  emptyMessage="No recovery episodes in the selected window"
                />
              </Grid>
            </Grid>
          </Box>

          <Box
            mt={3}
            mb={1.5}
            display="flex"
            alignItems="baseline"
            style={{ gap: 10 }}
          >
            <Typography variant="subtitle1" style={{ fontWeight: 650 }}>
              {labels.title}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Sorted by deployment frequency
            </Typography>
          </Box>
          <DoraBreakdownTable
            childLabel={labels.child}
            rows={breakdown.rows}
            loading={breakdown.loading}
            error={breakdown.error}
            onSelectEnvironment={
              level === 'component' ? setEnvFilter : undefined
            }
          />

          {level !== 'component' &&
            !envFilter &&
            breakdown.envRows.length > 0 && (
              <>
                <Box mt={3} mb={1.5}>
                  <Typography variant="subtitle1" style={{ fontWeight: 650 }}>
                    Deployment metrics by environment
                  </Typography>
                </Box>
                <DoraEnvironmentCards rows={breakdown.envRows} />
              </>
            )}

          {data && (
            <Box mt={2}>
              <Typography variant="caption" color="textSecondary">
                Window {new Date(data.window.startTime).toLocaleDateString()} –{' '}
                {new Date(data.window.endTime).toLocaleDateString()} · generated{' '}
                {new Date(data.window.generatedAt).toLocaleString()}
              </Typography>
            </Box>
          )}

          <Box
            mt={3}
            p={2}
            border={1}
            borderColor="divider"
            borderRadius={10}
            style={{ borderStyle: 'dashed' }}
          >
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 650 }}>
                How these metrics are calculated
              </summary>
              <Box mt={1.5}>
                <Typography
                  variant="body2"
                  component="div"
                  color="textSecondary"
                >
                  <b>Deployment Frequency</b> — successful deployments per
                  bucket, de-noised by rendered-release identity.
                  <br />
                  <b>Lead Time</b> — deploy-ready time minus commit-authored
                  time; commit provenance is carried on the Workload.
                  <br />
                  <b>Change Failure Rate</b> — deployments with a failed rollout
                  or an attributed incident ÷ total deployments.
                  <br />
                  <b>MTTR</b> — incident resolved minus triggered, or the
                  health-based recovery transition.
                  <br />
                  Ratings use standard DORA thresholds. Source: data-plane
                  delivery events + incident store, rolled up into the Delivery
                  Insights store.
                </Typography>
              </Box>
            </details>
          </Box>
        </>
      )}
    </Box>
  );
};
