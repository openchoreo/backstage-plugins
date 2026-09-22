import { useEffect, useMemo, useRef } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  Typography,
  useTheme,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { ProjectMetricGraph } from './ProjectMetricGraph';
import { Filters } from '../../types';
import { useDataPlaneNetPolProvider, useProjectMetrics } from '../../hooks';
import { formatMetricName, getMetricConfigs } from './utils';
import { componentColorResolver } from './colors';

type ProjectHTTPMetricsSectionProps = {
  filters: Filters;
  components: string[];
  namespaceName: string;
  project: string;
  refreshNonce: number;
  /** Page-level gate (per-environment metrics permission). */
  enabled: boolean;
};

/**
 * Mode 2 counterpart to `HTTPMetricsSection`. Same Cilium gate — HTTP metrics
 * come from the data plane's network policy provider, which is per-environment,
 * not per-component — but fanned out across the selected components.
 *
 * One card per metric, one line per component, laid out in the same grid as
 * the page's resource cards. A card per metric keeps many components readable,
 * where one card per group would stack several lines per component.
 */
export const ProjectHTTPMetricsSection = ({
  filters,
  components,
  namespaceName,
  project,
  refreshNonce,
  enabled,
}: ProjectHTTPMetricsSectionProps) => {
  const { networkPolicyProvider, loading: netPolLoading } =
    useDataPlaneNetPolProvider(
      namespaceName,
      filters.environment?.dataPlaneRef,
    );
  const httpEnabled = networkPolicyProvider === 'cilium';

  const { metrics, error, refresh } = useProjectMetrics(
    filters,
    components,
    namespaceName,
    project,
    'http',
    enabled && httpEnabled,
  );

  // Filters live in the query key, so a filter change refetches on its own.
  // Only the parent's explicit refresh (a `refreshNonce` bump, same key) needs
  // a manual poke.
  const previousRefreshNonceRef = useRef(refreshNonce);
  useEffect(() => {
    if (previousRefreshNonceRef.current !== refreshNonce) {
      previousRefreshNonceRef.current = refreshNonce;
      if (httpEnabled && enabled) refresh();
    }
  }, [refreshNonce, httpEnabled, enabled, refresh]);

  // The fan-out is partial-tolerant: `useProjectMetrics` only throws when every
  // component fails. A component missing from the charts is otherwise silent,
  // so name it here. The resource fan-out is a separate request and carries its
  // own failures, which the page reports.
  const failedComponents = metrics?.failedComponents ?? [];

  // One card per metric, throughput first, then latency, the same as the
  // resource cards: one line per component on each.
  const cards = useMemo(() => {
    const byMetric = metrics?.byMetric ?? {};
    return (['networkThroughput', 'networkLatency'] as const).flatMap(
      usageType =>
        Object.values(getMetricConfigs(usageType)).map(({ key }) => ({
          usageType,
          title: formatMetricName(key),
          series: byMetric[key] ?? {},
        })),
    );
  }, [metrics]);
  const theme = useTheme();
  const dark = theme.palette.type === 'dark';

  // Colour keys off the whole selection, not just the components that returned
  // data, so a component keeps its colour across time-range changes.
  const colorOf = useMemo(
    () => componentColorResolver(components, dark),
    [components, dark],
  );

  if (netPolLoading || !httpEnabled) {
    return null;
  }

  if (error) {
    const isMetricsModuleError = error.toLowerCase().includes('metrics module');
    const isObservabilityDisabled = error.includes(
      'Observability is not enabled',
    );

    let headline = 'Failed to load HTTP metrics.';
    if (isObservabilityDisabled) {
      headline =
        'HTTP metrics are unavailable: observability is not enabled for this project in the current environment.';
    } else if (isMetricsModuleError) {
      headline =
        'HTTP metrics are unavailable. Check the metrics module configuration.';
    }

    return (
      <Grid item xs={12}>
        <Alert severity={isObservabilityDisabled ? 'info' : 'error'}>
          <Typography variant="body1">{headline}</Typography>
          {!isObservabilityDisabled && (
            <Typography variant="body2">{error}</Typography>
          )}
          {!isMetricsModuleError && !isObservabilityDisabled && (
            <Button onClick={() => refresh()} color="inherit" size="small">
              Retry
            </Button>
          )}
        </Alert>
      </Grid>
    );
  }

  return (
    <>
      {/* Partial success: the charts below are real, they are just missing the
          named components. An error alert would overstate it. */}
      {failedComponents.length > 0 && (
        <Grid item xs={12}>
          <Alert severity="info">
            <Typography variant="body1">
              No HTTP metrics for{' '}
              {failedComponents.map(component => component.name).join(', ')}.
              Observability may not be enabled for{' '}
              {failedComponents.length === 1 ? 'it' : 'them'} in this
              environment.
            </Typography>
          </Alert>
        </Grid>
      )}
      {cards.map(({ usageType, title, series }) => (
        <Grid item xs={12} md={6} xl={4} key={title}>
          <Card>
            <CardHeader title={title} />
            <Divider />
            <CardContent>
              <ProjectMetricGraph
                series={series}
                colorOf={colorOf}
                usageType={usageType}
                timeRange={filters.timeRange}
                customStartTime={filters.customStartTime}
                customEndTime={filters.customEndTime}
              />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </>
  );
};
