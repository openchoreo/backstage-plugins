import { useMemo } from 'react';
import { Box, Button, Typography, makeStyles } from '@material-ui/core';
import { Link as RouterLink } from 'react-router-dom';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Card, Skeleton } from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { TotalCostContent } from './CostSummaryCards';
import { deriveLevel } from './costAggregation';
import { useNamespaceEnvironments } from './useNamespaceEnvironments';
import { useCostInsights } from './useCostInsights';
import type { CostScope } from './types';

// The summary window (a TIME_RANGE_OPTIONS value — `24h`, not the `1d`
// granularity token). Passed through to the deep link so the Cost Insights page
// opens on the same range as the figure shown here.
const COST_SUMMARY_TIME_RANGE = '24h';
const COST_SUMMARY_TIME_RANGE_LABEL = 'Last 24 hours';

const useStyles = makeStyles(theme => ({
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '12px !important',
  },
  cardHeader: {
    marginBottom: theme.spacing(2),
  },
  // Matches the "About" card's CardHeader title (MUI default variant h5).
  cardTitle: {
    fontWeight: theme.typography.h5.fontWeight,
    fontSize: theme.typography.h5.fontSize,
    color: theme.palette.text.primary,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    marginBottom: theme.spacing(2),
  },
  timeRangeLabel: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.5),
  },
  message: {
    color: theme.palette.text.secondary,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
}));

/**
 * Derives the Cost Insights scope from the entity: components map to
 * namespace/project/component, projects (Systems) to namespace/project. The
 * openchoreo identifiers live in annotations and match what the observer cost
 * API and the Cost Insights page expect.
 */
function useEntityCostScope(): { scope: CostScope; ready: boolean } {
  const { entity } = useEntity();
  return useMemo(() => {
    const ann = entity.metadata.annotations ?? {};
    const namespace = ann[CHOREO_ANNOTATIONS.NAMESPACE];
    if (entity.kind.toLowerCase() === 'component') {
      const project = ann[CHOREO_ANNOTATIONS.PROJECT];
      const component =
        ann[CHOREO_ANNOTATIONS.COMPONENT] ?? entity.metadata.name;
      return {
        scope: { namespace, project, component },
        ready: Boolean(namespace && project),
      };
    }
    // System entity → project scope. The project name is the entity's own name.
    return {
      scope: { namespace, project: entity.metadata.name },
      ready: Boolean(namespace),
    };
  }, [entity]);
}

function buildDeepLink(scope: CostScope): string {
  const params = new URLSearchParams();
  if (scope.namespace) params.set('namespace', scope.namespace);
  if (scope.project) params.set('project', scope.project);
  if (scope.component) params.set('component', scope.component);
  params.set('timeRange', COST_SUMMARY_TIME_RANGE);
  return `/cost-insights?${params.toString()}`;
}

/**
 * Overview-tab card summarizing a component's or project's cost, reusing the
 * Cost Insights "Total Cost" summary card and deep-linking to the full page.
 */
export const CostInsightsSummaryCard = () => {
  const classes = useStyles();
  const { scope, ready } = useEntityCostScope();

  const { environments, loading: envsLoading } = useNamespaceEnvironments(
    ready ? scope.namespace : undefined,
  );
  const envNames = useMemo(() => environments.map(e => e.name), [environments]);

  const { data, loading, error } = useCostInsights({
    scopes: ready ? [scope] : [],
    level: deriveLevel(scope),
    environments: ready ? envNames : [],
    timeRange: COST_SUMMARY_TIME_RANGE,
    view: 'table',
    // Table view ignores granularity; a valid value keeps the hook's key stable.
    granularity: '1h',
  });

  const busy = envsLoading || loading;

  const renderBody = () => {
    if (busy) {
      return <Skeleton variant="rect" height={56} />;
    }
    if (error || !data) {
      return (
        <Typography variant="body2" className={classes.message}>
          {error ?? 'No cost data available'}
        </Typography>
      );
    }
    return <TotalCostContent summary={data.summary} dense />;
  };

  return (
    <Card padding={16} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography className={classes.cardTitle}>Cost Insights</Typography>
      </Box>
      <Box className={classes.content}>
        <Typography className={classes.timeRangeLabel}>
          {COST_SUMMARY_TIME_RANGE_LABEL}
        </Typography>
        {renderBody()}
      </Box>
      {ready && (
        <Box className={classes.footer}>
          <Button
            component={RouterLink}
            to={buildDeepLink(scope)}
            variant="outlined"
            color="primary"
            size="small"
          >
            Go to Cost Insights
          </Button>
        </Box>
      )}
    </Card>
  );
};
