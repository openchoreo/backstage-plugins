import { lazy, Suspense, useCallback, useMemo } from 'react';
import {
  Link as RouterLink,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { useApp } from '@backstage/core-plugin-api';
import { Page, Content, Header } from '@backstage/core-components';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { Box, Typography, makeStyles } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import {
  PageLoader,
  RefreshOverlay,
} from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { parseUrlTimeRange, writeUrlTimeRange } from '../../utils/urlTimeRange';
import { CostInsightsScopeFilters } from './CostInsightsScopeFilters';
import { expandSelection } from './costAggregation';
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
import type {
  CostComponentRef,
  CostProjectRef,
  CostScopeSelection,
  CostViewMode,
} from './types';

// Cost Analysis is a heavier feature (report views, FinOps chat). Load it lazily
// so it only enters the bundle when the Cost Analysis tab is opened.
const CostAnalysisPage = lazy(() =>
  import('../CostAnalysis').then(m => ({ default: m.CostAnalysisPage })),
);

const DEFAULT_NAMESPACE = 'default';
const COST_DEFAULT_TIME_RANGE = '1h';
const COST_INSIGHTS_PATH = '/cost-insights';

// The catalog kind each table row maps to, so we reuse the app's registered
// kind icons (same symbols the catalog shows).
const LEVEL_KIND: Record<string, string> = {
  namespace: 'system', // rows are projects (Project = System)
  project: 'component',
  component: 'environment',
};

const useStyles = makeStyles(theme => ({
  section: { marginTop: theme.spacing(2) },
  analysisContent: { marginTop: theme.spacing(3) },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tab: {
    padding: theme.spacing(1.5, 1),
    fontSize: 14,
    fontWeight: 500,
    color: theme.palette.text.secondary,
    textDecoration: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    '&:hover': { color: theme.palette.text.primary },
  },
  tabActive: {
    color: theme.palette.primary.main,
    borderBottomColor: theme.palette.primary.main,
    fontWeight: 600,
  },
}));

const projectValue = (p: CostProjectRef) => `${p.namespace}/${p.name}`;
const componentValue = (c: CostComponentRef) =>
  `${c.namespace}/${c.project}/${c.name}`;

/**
 * Parse the multi-select scope from the URL. Reads the plural params
 * (`namespaces`/`projects`/`components`) and falls back to the legacy singular
 * params (`namespace`/`project`/`component`) so existing deep links still land
 * on the right scope. An absent namespace defaults to `default`.
 */
function parseSelection(params: URLSearchParams): CostScopeSelection {
  const nsRaw = params.get('namespaces');
  const legacyNs = params.get('namespace');
  let namespaces: string[];
  if (nsRaw !== null) namespaces = nsRaw.split(',').filter(Boolean);
  else if (legacyNs) namespaces = [legacyNs];
  else namespaces = [DEFAULT_NAMESPACE];

  const projRaw = params.get('projects');
  const legacyProj = params.get('project');
  let projects: CostProjectRef[];
  if (projRaw !== null) {
    projects = projRaw
      .split(',')
      .filter(Boolean)
      .map(v => {
        const [namespace, name] = v.split('/');
        return { namespace, name };
      });
  } else if (legacyProj && namespaces.length > 0) {
    projects = [{ namespace: namespaces[0], name: legacyProj }];
  } else {
    projects = [];
  }

  const compRaw = params.get('components');
  const legacyComp = params.get('component');
  let components: CostComponentRef[];
  if (compRaw !== null) {
    components = compRaw
      .split(',')
      .filter(Boolean)
      .map(v => {
        const [namespace, project, name] = v.split('/');
        return { namespace, project, name };
      });
  } else if (legacyComp && projects.length > 0) {
    components = [
      {
        namespace: projects[0].namespace,
        project: projects[0].name,
        name: legacyComp,
      },
    ];
  } else {
    components = [];
  }

  return { namespaces, projects, components };
}

function writeSelection(params: URLSearchParams, sel: CostScopeSelection) {
  // Drop the legacy singular params so the plural ones are the single source.
  params.delete('namespace');
  params.delete('project');
  params.delete('component');
  params.set('namespaces', sel.namespaces.join(','));
  if (sel.projects.length) {
    params.set('projects', sel.projects.map(projectValue).join(','));
  } else {
    params.delete('projects');
  }
  if (sel.components.length) {
    params.set('components', sel.components.map(componentValue).join(','));
  } else {
    params.delete('components');
  }
}

// Reads the multi-select cost scope + a generic param updater from the URL,
// shared by the page header, the filters, and both tabs.
function useCostSelection() {
  const [searchParams, setSearchParams] = useSearchParams();

  const selection = useMemo(() => parseSelection(searchParams), [searchParams]);

  const update = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutator(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setSelection = useCallback(
    (next: CostScopeSelection) => {
      update(params => {
        const namespacesChanged =
          next.namespaces.length !== selection.namespaces.length ||
          next.namespaces.some(n => !selection.namespaces.includes(n));
        writeSelection(params, next);
        // Environments belong to a namespace, so reset the selection when the
        // namespace set changes (the previous names may not all exist now).
        if (namespacesChanged) params.delete('envs');
      });
    },
    [update, selection.namespaces],
  );

  return { selection, setSelection, update, searchParams };
}

// The "Insights" tab: cost table/graph views, all state read from the URL.
const CostInsightsInsightsTab = () => {
  const classes = useStyles();
  const app = useApp();
  const { selection, update, searchParams } = useCostSelection();

  const { level, scopes } = expandSelection(selection);
  // Raw dimension name to catalog title, so rows read "GCP Microservice Demo".
  const titles = useDimensionTitles(level, scopes);

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

  // --- Environments across the selected namespaces ---
  const {
    environments,
    loading: envsLoading,
    error: envsError,
  } = useNamespaceEnvironments(selection.namespaces);

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

  // --- Cost data ---
  const { data, loading, isRefetching, error, refresh } = useCostInsights({
    scopes,
    level,
    environments: selectedEnvironments,
    timeRange,
    customStartTime,
    customEndTime,
    view,
    granularity,
  });

  // Optimize/Apply acts on a single ReleaseBinding, so it's only offered when
  // exactly one component is in scope.
  const optimizeScope =
    level === 'component' && scopes.length === 1 ? scopes[0] : undefined;

  const noScope = scopes.length === 0;
  const noEnvironments =
    !noScope && !envsLoading && !envsError && environments.length === 0;

  return (
    <>
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

      {noScope && (
        <Box className={classes.section}>
          <Alert severity="info">
            Select one or more namespaces to view cost insights.
          </Alert>
        </Box>
      )}

      {envsError && (
        <Box className={classes.section}>
          <Alert severity="error">{envsError}</Alert>
        </Box>
      )}

      {noEnvironments && (
        <Box className={classes.section}>
          <Alert severity="info">
            No environments found for the selected namespaces.
          </Alert>
        </Box>
      )}

      {!noScope &&
        !noEnvironments &&
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
          <RefreshOverlay active={isRefetching} label="Refreshing cost data" />
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
                icon={app.getSystemIcon(`kind:${LEVEL_KIND[data.level]}`)}
                titles={titles}
                scope={optimizeScope}
                onOptimized={refresh}
                singleComponent={
                  data.level === 'component' && scopes.length === 1
                }
              />
            )}
          </Box>
        </Box>
      )}

      {!loading && !data && !error && !noScope && !noEnvironments && (
        <Box className={classes.section}>
          <Typography color="textSecondary">
            Select a scope and environments to view cost insights.
          </Typography>
        </Box>
      )}
    </>
  );
};

// The "Cost Analysis" tab (FinOps reports). It reads its project/namespace from
// entity context, so we synthesize a System entity from the single selected
// project; it's only available when exactly one project is in scope.
const CostAnalysisTab = () => {
  const classes = useStyles();
  const { selection } = useCostSelection();

  const project =
    selection.projects.length === 1 ? selection.projects[0] : undefined;

  const syntheticEntity: Entity | undefined = useMemo(
    () =>
      project
        ? {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'System',
            metadata: {
              name: project.name,
              // OpenChoreo catalog entities live in the default catalog namespace.
              namespace: 'default',
              annotations: {
                [CHOREO_ANNOTATIONS.NAMESPACE]: project.namespace,
              },
            },
            spec: {},
          }
        : undefined,
    [project],
  );

  if (!syntheticEntity) {
    return (
      <Box className={classes.section}>
        <Alert severity="info">
          Select a single project to view its cost analysis reports.
        </Alert>
      </Box>
    );
  }

  return (
    <Box className={classes.analysisContent}>
      <EntityProvider entity={syntheticEntity}>
        <Suspense fallback={<PageLoader />}>
          <CostAnalysisPage />
        </Suspense>
      </EntityProvider>
    </Box>
  );
};

const CostInsightsTabBar = () => {
  const classes = useStyles();
  const location = useLocation();
  const onCostAnalysis = location.pathname.endsWith('/cost-analysis');
  const tabClass = (active: boolean) =>
    active ? `${classes.tab} ${classes.tabActive}` : classes.tab;

  return (
    <Box className={classes.tabBar} role="tablist">
      <RouterLink
        to={{ pathname: COST_INSIGHTS_PATH, search: location.search }}
        className={tabClass(!onCostAnalysis)}
        role="tab"
        aria-selected={!onCostAnalysis}
      >
        Insights
      </RouterLink>
      <RouterLink
        to={{
          pathname: `${COST_INSIGHTS_PATH}/cost-analysis`,
          search: location.search,
        }}
        className={tabClass(onCostAnalysis)}
        role="tab"
        aria-selected={onCostAnalysis}
      >
        Analysis Reports
      </RouterLink>
    </Box>
  );
};

export const CostInsightsPage = () => {
  const { selection, setSelection } = useCostSelection();

  return (
    <Page themeId="tool">
      <Header title="Cost Insights" />
      <Content>
        <CostInsightsScopeFilters
          selection={selection}
          onChange={setSelection}
        />
        <CostInsightsTabBar />
        <Routes>
          <Route index element={<CostInsightsInsightsTab />} />
          <Route path="cost-analysis" element={<CostAnalysisTab />} />
        </Routes>
      </Content>
    </Page>
  );
};
