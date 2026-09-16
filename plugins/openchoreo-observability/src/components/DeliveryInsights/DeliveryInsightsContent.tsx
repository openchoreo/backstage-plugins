import { useCallback, useEffect, useMemo } from 'react';
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
import { useNamespaceEnvironments } from '../CostInsights/useNamespaceEnvironments';
import {
  INSIGHTS_TIME_RANGES,
  fillSeriesGaps,
  formatDurationMs,
  collectionWarning,
  formatPercent,
  measuredRates,
  nullUnmeasuredRates,
} from './utils';

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

export interface DeliveryInsightsContentProps {
  /** Resolved query scope; null while the scope is still being resolved. */
  scope: DoraSearchScope | null;
  /** Scope level driving breakdown labels and sections; null while loading. */
  level: InsightsLevel | null;
  /** Trailing window length in days (see `INSIGHTS_TIME_RANGES`). */
  rangeDays: number;
  granularity: DoraGranularity;
  /** Environment name, or '' for all environments. */
  envFilter: string;
  onRangeDaysChange: (days: number) => void;
  onGranularityChange: (granularity: DoraGranularity) => void;
  onEnvFilterChange: (environment: string) => void;
  /**
   * Drill into a breakdown row one level down (a project or component). Absent
   * at component level, where rows are environments and apply as a filter.
   */
  onDrill?: (childName: string) => void;
}

/**
 * The Delivery Insights (DORA metrics) surface, per the Insights wireframe:
 * filter bar (range / granularity / environment), four KPI tiles with rating +
 * delta + sparkline, four trend charts, a one-level-down breakdown table, a
 * and a per-environment section. Serves the namespace, project, and component
 * levels — scope/level are the only differences between them.
 *
 * Fully controlled: the hosting page owns the filter state so it can keep it in
 * the URL, making a given view bookmarkable.
 */
export const DeliveryInsightsContent = ({
  scope,
  level,
  rangeDays,
  granularity,
  envFilter,
  onRangeDaysChange,
  onGranularityChange,
  onEnvFilterChange,
  onDrill,
}: DeliveryInsightsContentProps) => {
  // The environment filter narrows the headline tiles/charts (and the
  // project/component breakdown children inherit it); the per-environment
  // section always shows all environments, so it hides while a filter is on.
  const effectiveScope = useMemo((): DoraSearchScope | null => {
    if (!scope) {
      return null;
    }
    return envFilter ? { ...scope, environment: envFilter } : scope;
  }, [scope, envFilter]);

  const { data, loading, error, spansMultiplePlanes, refetch } =
    useDoraInsights(effectiveScope, rangeDays, granularity);
  const breakdown = useDoraBreakdown(
    level,
    level === 'component' ? scope : effectiveScope,
    rangeDays,
    granularity,
  );

  // The breakdown knows which environments have data, but only by name. The
  // catalog holds the display name, which is what every other filter shows
  // (logs, metrics, cost), so look it up and fall back to the name.
  const { environments: catalogEnvironments } = useNamespaceEnvironments(
    scope?.namespace,
  );
  const environmentLabel = useMemo(() => {
    const byName = new Map(
      catalogEnvironments.map(env => [env.name, env.displayName || env.name]),
    );
    return (name: string) => byName.get(name) ?? name;
  }, [catalogEnvironments]);

  // The breakdown issues its own metric requests, so a refresh has to reload
  // both or the table and env cards keep showing an older snapshot than the
  // tiles and charts.
  const refetchBreakdown = breakdown.refetch;
  const refreshAll = useCallback(() => {
    refetch();
    refetchBreakdown();
  }, [refetch, refetchBreakdown]);

  // `leadTime`/`mttr` only include buckets that had data; align them to the
  // zero-filled deployment-frequency buckets so missing periods render as gaps
  // instead of the line bridging across them.
  const buckets = data?.series?.deploymentFrequency;
  const leadTimeSeries = useMemo(
    () =>
      fillSeriesGaps(buckets, data?.series?.leadTime, [
        'p50Ms',
        'p75Ms',
        'p95Ms',
      ]),
    [buckets, data?.series?.leadTime],
  );
  const mttrSeries = useMemo(
    () => fillSeriesGaps(buckets, data?.series?.mttr, ['meanMs']),
    [buckets, data?.series?.mttr],
  );
  // A namespace whose environments report to different observability planes has
  // no observer that can answer for all of them, so the aggregate view is not
  // just empty -- it cannot be computed. Drop the option and settle on a single
  // environment rather than leaving a choice that always fails.
  useEffect(() => {
    if (
      spansMultiplePlanes &&
      !envFilter &&
      breakdown.environments.length > 0
    ) {
      onEnvFilterChange(breakdown.environments[0]);
    }
  }, [
    spansMultiplePlanes,
    envFilter,
    breakdown.environments,
    onEnvFilterChange,
  ]);

  const configWarning = collectionWarning(data?.collection);
  const cfrSeries = useMemo(
    () => nullUnmeasuredRates(data?.series?.changeFailureRate),
    [data?.series?.changeFailureRate],
  );
  const cfrSparkData = useMemo(
    () => measuredRates(data?.series?.changeFailureRate),
    [data?.series?.changeFailureRate],
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
          onChange={event => onRangeDaysChange(Number(event.target.value))}
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
            onGranularityChange(event.target.value as DoraGranularity)
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
          label="Environment"
          value={envFilter}
          onChange={event => onEnvFilterChange(event.target.value)}
          style={{ minWidth: 160 }}
        >
          {!spansMultiplePlanes && (
            <MenuItem value="">All environments</MenuItem>
          )}
          {breakdown.environments.map(env => (
            <MenuItem key={env} value={env}>
              {environmentLabel(env)}
            </MenuItem>
          ))}
        </TextField>
        <Box flexGrow={1} />
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={refreshAll}
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

      {!error && spansMultiplePlanes && (
        <Box mb={2}>
          <Alert severity="info">
            This namespace's environments report to different observability
            planes, so there is no single source for a combined view. Metrics
            are shown one environment at a time.
          </Alert>
        </Box>
      )}

      {!error && !spansMultiplePlanes && configWarning && (
        <Box mb={2}>
          <Alert severity="info">{configWarning}</Alert>
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
                value={cfr && cfr.total > 0 ? formatPercent(cfr.rate) : '—'}
                classification={cfr?.classification ?? 'Unknown'}
                deltaPct={cfr?.deltaPct ?? null}
                positiveDeltaIsGood={false}
                subText={
                  cfr ? `${cfr.failed} of ${cfr.total} failed` : undefined
                }
                sparkData={cfrSparkData}
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
                  title="Deployment Frequency"
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
                  data={leadTimeSeries}
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
                  data={cfrSeries}
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
                  data={mttrSeries}
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

          <Box mt={3} mb={1.5}>
            <Typography variant="subtitle1" style={{ fontWeight: 650 }}>
              {labels.title}
            </Typography>
          </Box>
          <DoraBreakdownTable
            childLabel={labels.child}
            rows={breakdown.rows}
            loading={breakdown.loading}
            error={breakdown.error}
            onDrill={level === 'component' ? undefined : onDrill}
            onSelectEnvironment={
              level === 'component' ? onEnvFilterChange : undefined
            }
          />

          {level !== 'component' &&
            !envFilter &&
            breakdown.envRows.length > 0 && (
              <>
                <Box mt={3} mb={1.5}>
                  <Typography variant="subtitle1" style={{ fontWeight: 650 }}>
                    Delivery performance by environment
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
        </>
      )}
    </Box>
  );
};
