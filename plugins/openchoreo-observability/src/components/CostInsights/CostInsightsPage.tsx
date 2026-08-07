import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '@backstage/core-plugin-api';
import { Page, Header, Content } from '@backstage/core-components';
import { Box, Chip, Typography, makeStyles } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import {
  PageLoader,
  RefreshOverlay,
} from '@openchoreo/backstage-design-system';
import { parseUrlTimeRange, writeUrlTimeRange } from '../../utils/urlTimeRange';
import { CostInsightsBreadcrumb } from './CostInsightsBreadcrumb';
import { deriveLevel } from './costAggregation';
import {
  CostInsightsFilters,
  DEFAULT_GRANULARITY,
} from './CostInsightsFilters';
import { CostSummaryCards } from './CostSummaryCards';
import { CostInsightsTable } from './CostInsightsTable';
import { CostInsightsGraphs } from './CostInsightsGraphs';
import { useNamespaceEnvironments } from './useNamespaceEnvironments';
import { useDimensionTitles } from './useDimensionTitles';
import { useCostInsights } from './useCostInsights';
import type { CostScope, CostViewMode } from './types';

const DEFAULT_NAMESPACE = 'default';
const COST_DEFAULT_TIME_RANGE = '1h';

// The catalog kind each table row maps to, so we reuse the app's registered
// kind icons (same symbols the catalog shows).
const LEVEL_KIND: Record<string, string> = {
  namespace: 'system', // rows are projects (Project = System)
  project: 'component',
  component: 'environment',
};

const useStyles = makeStyles(theme => ({
  section: { marginTop: theme.spacing(2) },
  titleRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  // Mirrors the entity header's kind chip: legible on the gradient bar in both
  // themes via `theme.page.fontColor`.
  levelChip: {
    color: theme.page.fontColor,
    borderColor: `${theme.page.fontColor}80`,
    fontSize: '0.7rem',
    fontWeight: 600,
    height: 24,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
}));

export const CostInsightsPage = () => {
  const classes = useStyles();
  const app = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- URL state ---
  const namespace = searchParams.get('namespace') || DEFAULT_NAMESPACE;
  const project = searchParams.get('project') || undefined;
  // A component is only meaningful when a project is also selected.
  const component = project
    ? searchParams.get('component') || undefined
    : undefined;
  const scope: CostScope = useMemo(
    () => ({ namespace, project, component }),
    [namespace, project, component],
  );
  const level = deriveLevel(scope);
  // Raw dimension name to catalog title, so rows read "GCP Microservice Demo".
  const titles = useDimensionTitles(level, scope);

  const view: CostViewMode =
    searchParams.get('view') === 'graph' ? 'graph' : 'table';
  const granularity = searchParams.get('granularity') || DEFAULT_GRANULARITY;
  const { timeRange, customStartTime, customEndTime } = parseUrlTimeRange(
    searchParams,
    COST_DEFAULT_TIME_RANGE,
  );
  // `null` means the param is absent (default to all environments); a present
  // value — even empty — is an explicit user selection we must preserve.
  const envsRaw = searchParams.get('envs');
  const envsParam = useMemo(
    () => (envsRaw === null ? null : envsRaw.split(',').filter(Boolean)),
    [envsRaw],
  );

  const update = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutator(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const onScopeChange = useCallback(
    (nextScope: CostScope) => {
      update(params => {
        const namespaceChanged = nextScope.namespace !== namespace;
        if (nextScope.namespace) params.set('namespace', nextScope.namespace);
        else params.delete('namespace');
        if (nextScope.project) params.set('project', nextScope.project);
        else params.delete('project');
        if (nextScope.component) params.set('component', nextScope.component);
        else params.delete('component');
        // Environments belong to a namespace, so reset the selection when the
        // namespace changes (the previous names may not exist in the new one).
        if (namespaceChanged) params.delete('envs');
      });
    },
    [update, namespace],
  );

  // --- Environments for the current namespace ---
  const {
    environments,
    loading: envsLoading,
    error: envsError,
  } = useNamespaceEnvironments(namespace);

  // Default to every environment until the user narrows the selection, so the
  // page shows aggregated data immediately.
  const allEnvNames = useMemo(
    () => environments.map(e => e.name),
    [environments],
  );
  // Absent param means default to all; a present selection (including an explicit
  // empty one) is honored as-is.
  const selectedEnvironments = envsParam === null ? allEnvNames : envsParam;

  const onEnvironmentsChange = useCallback(
    (names: string[]) => {
      update(params => {
        // An explicit "all selected" is stored as absent (the default), so the
        // URL stays clean and keeps meaning "all". Selecting none serializes an
        // explicit empty value so it survives a reload and the "select
        // environments" alert can render.
        const isAll = names.length > 0 && names.length === allEnvNames.length;
        if (isAll) params.delete('envs');
        else params.set('envs', names.join(','));
      });
    },
    [update, allEnvNames.length],
  );

  const onViewChange = useCallback(
    (nextView: CostViewMode) =>
      update(params => {
        if (nextView === 'table') params.delete('view');
        else params.set('view', nextView);
      }),
    [update],
  );

  const onTimeRangeChange = useCallback(
    (next: {
      timeRange: string;
      customStartTime?: string;
      customEndTime?: string;
    }) =>
      update(params =>
        writeUrlTimeRange(params, next, COST_DEFAULT_TIME_RANGE),
      ),
    [update],
  );

  const onGranularityChange = useCallback(
    (next: string) =>
      update(params => {
        if (next === DEFAULT_GRANULARITY) params.delete('granularity');
        else params.set('granularity', next);
      }),
    [update],
  );

  // Drill one level deeper by clicking a table row: namespace to project,
  // project to component (component rows are leaf environments).
  const onDrill = useCallback(
    (key: string) => {
      if (project) {
        onScopeChange({ namespace, project, component: key });
      } else {
        onScopeChange({ namespace, project: key });
      }
    },
    [namespace, project, onScopeChange],
  );

  // --- Cost data ---
  const { data, loading, isRefetching, error, refresh } = useCostInsights({
    scope,
    environments: selectedEnvironments,
    timeRange,
    customStartTime,
    customEndTime,
    view,
    granularity,
  });

  const noEnvironments =
    !envsLoading && !envsError && environments.length === 0;

  return (
    <Page themeId="tool">
      <Header
        title={
          <Box component="span" className={classes.titleRow}>
            <span>Cost Insights</span>
            <Chip
              component="span"
              label={level}
              variant="outlined"
              size="small"
              className={classes.levelChip}
            />
          </Box>
        }
        pageTitleOverride="Cost Insights"
        subtitle={
          <CostInsightsBreadcrumb scope={scope} onScopeChange={onScopeChange} />
        }
      />
      <Content>
        <Box className={classes.section}>
          <CostInsightsFilters
            environments={environments}
            environmentsLoading={envsLoading}
            selectedEnvironments={selectedEnvironments}
            onEnvironmentsChange={onEnvironmentsChange}
            view={view}
            onViewChange={onViewChange}
            timeRange={timeRange}
            customStartTime={customStartTime}
            customEndTime={customEndTime}
            onTimeRangeChange={onTimeRangeChange}
          />
        </Box>

        {envsError && (
          <Box className={classes.section}>
            <Alert severity="error">{envsError}</Alert>
          </Box>
        )}

        {noEnvironments && (
          <Box className={classes.section}>
            <Alert severity="info">
              No environments found for namespace “{namespace}”.
            </Alert>
          </Box>
        )}

        {!noEnvironments &&
          selectedEnvironments.length === 0 &&
          !envsLoading && (
            <Box className={classes.section}>
              <Alert severity="info">
                Select one or more environments to view cost insights.
              </Alert>
            </Box>
          )}

        {error && (
          <Box className={classes.section}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {loading && <PageLoader />}

        {!loading && data && (
          <Box position="relative">
            <RefreshOverlay
              active={isRefetching}
              label="Refreshing cost data"
            />
            {view !== 'graph' && (
              <Box className={classes.section}>
                <CostSummaryCards summary={data.summary} />
              </Box>
            )}
            <Box className={classes.section}>
              {view === 'graph' ? (
                <CostInsightsGraphs
                  data={data}
                  granularity={granularity}
                  onGranularityChange={onGranularityChange}
                />
              ) : (
                <CostInsightsTable
                  level={data.level}
                  rows={data.rows}
                  onDrill={data.level === 'component' ? undefined : onDrill}
                  icon={app.getSystemIcon(`kind:${LEVEL_KIND[data.level]}`)}
                  titles={titles}
                  scope={scope}
                  onOptimized={refresh}
                />
              )}
            </Box>
          </Box>
        )}

        {!loading && !data && !error && !noEnvironments && (
          <Box className={classes.section}>
            <Typography color="textSecondary">
              Select a scope and environments to view cost insights.
            </Typography>
          </Box>
        )}
      </Content>
    </Page>
  );
};
