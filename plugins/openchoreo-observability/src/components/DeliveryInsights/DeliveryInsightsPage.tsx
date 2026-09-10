import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Header, Content } from '@backstage/core-components';
import { Box, Chip, makeStyles } from '@material-ui/core';
import { ScopeBreadcrumb, ScopeSelection } from '../ScopeBreadcrumb';
import { DoraGranularity, DoraSearchScope } from '../../types';
import { DeliveryInsightsContent } from './DeliveryInsightsContent';
import { InsightsLevel } from './useDoraBreakdown';
import { INSIGHTS_TIME_RANGES } from './utils';

const DEFAULT_NAMESPACE = 'default';
const DEFAULT_RANGE_DAYS = 30;
const DEFAULT_GRANULARITY: DoraGranularity = 'daily';

const GRANULARITIES: DoraGranularity[] = ['daily', 'weekly', 'monthly'];

/**
 * The DORA query level implied by how deep the scope selection goes. The
 * observer's scope names follow the catalog kinds (Namespace = Domain,
 * Project = System), so the header chip shows the OpenChoreo term instead.
 */
function deriveLevel(scope: ScopeSelection): InsightsLevel {
  if (scope.component) {
    return 'component';
  }
  if (scope.project) {
    return 'system';
  }
  return 'domain';
}

const LEVEL_LABEL: Record<InsightsLevel, string> = {
  domain: 'namespace',
  system: 'project',
  component: 'component',
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

/**
 * Standalone Delivery Insights (DORA metrics) page, reached from the sidebar
 * rather than an entity tab — the audience is delivery leadership looking
 * across an organisation, not a developer on one component.
 *
 * All view state lives in the URL (scope, range, granularity, environment) so a
 * particular view can be bookmarked and shared.
 */
export const DeliveryInsightsPage = () => {
  const classes = useStyles();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- URL state ---
  const namespace = searchParams.get('namespace') || DEFAULT_NAMESPACE;
  const project = searchParams.get('project') || undefined;
  // A component is only meaningful when a project is also selected.
  const component = project
    ? searchParams.get('component') || undefined
    : undefined;
  const environment = searchParams.get('env') || '';

  const rangeParam = Number(searchParams.get('range'));
  const rangeDays = INSIGHTS_TIME_RANGES.some(r => r.days === rangeParam)
    ? rangeParam
    : DEFAULT_RANGE_DAYS;

  const granularityParam = searchParams.get('granularity') as DoraGranularity;
  const granularity = GRANULARITIES.includes(granularityParam)
    ? granularityParam
    : DEFAULT_GRANULARITY;

  const scope: DoraSearchScope = useMemo(
    () => ({ namespace, project, component }),
    [namespace, project, component],
  );
  const level = deriveLevel(scope);

  const update = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutator(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const onScopeChange = useCallback(
    (nextScope: ScopeSelection) => {
      update(params => {
        const namespaceChanged = nextScope.namespace !== namespace;
        if (nextScope.namespace) params.set('namespace', nextScope.namespace);
        else params.delete('namespace');
        if (nextScope.project) params.set('project', nextScope.project);
        else params.delete('project');
        if (nextScope.component) params.set('component', nextScope.component);
        else params.delete('component');
        // Environments belong to a namespace, so drop the filter when the
        // namespace changes (the previous name may not exist in the new one).
        if (namespaceChanged) params.delete('env');
      });
    },
    [update, namespace],
  );

  const onRangeDaysChange = useCallback(
    (days: number) =>
      update(params => {
        if (days === DEFAULT_RANGE_DAYS) params.delete('range');
        else params.set('range', String(days));
      }),
    [update],
  );

  const onGranularityChange = useCallback(
    (next: DoraGranularity) =>
      update(params => {
        if (next === DEFAULT_GRANULARITY) params.delete('granularity');
        else params.set('granularity', next);
      }),
    [update],
  );

  const onEnvFilterChange = useCallback(
    (next: string) =>
      update(params => {
        if (next) params.set('env', next);
        else params.delete('env');
      }),
    [update],
  );

  // Drill one level deeper by clicking a breakdown row: namespace to project,
  // project to component. Component-level rows are environments, which the
  // content applies as the environment filter instead.
  const onDrill = useCallback(
    (childName: string) => {
      if (project) {
        onScopeChange({ namespace, project, component: childName });
      } else {
        onScopeChange({ namespace, project: childName });
      }
    },
    [namespace, project, onScopeChange],
  );

  return (
    <Page themeId="tool">
      <Header
        title={
          <Box component="span" className={classes.titleRow}>
            <span>Delivery Insights</span>
            <Chip
              component="span"
              label={LEVEL_LABEL[level]}
              variant="outlined"
              size="small"
              className={classes.levelChip}
            />
          </Box>
        }
        pageTitleOverride="Delivery Insights"
        subtitle={
          <ScopeBreadcrumb
            scope={scope}
            onScopeChange={onScopeChange}
            queryKeyPrefix="insights-scope"
          />
        }
      />
      <Content>
        <Box className={classes.section}>
          <DeliveryInsightsContent
            scope={scope}
            level={level}
            rangeDays={rangeDays}
            granularity={granularity}
            envFilter={environment}
            onRangeDaysChange={onRangeDaysChange}
            onGranularityChange={onGranularityChange}
            onEnvFilterChange={onEnvFilterChange}
            onDrill={onDrill}
          />
        </Box>
      </Content>
    </Page>
  );
};
