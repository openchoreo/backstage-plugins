import { useMemo } from 'react';
import { Box, Divider, Tab, Tabs, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import {
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { DoraSearchScope } from '../../types';
import { InsightsContent } from './InsightsContent';
import { CostAnalysisPage } from '../CostAnalysis';

type InsightsEntityKind = 'domain' | 'system' | 'component';

/**
 * Cost Insights inner tab. FinOps cost analysis is project-scoped today, so the
 * existing CostAnalysis experience is embedded on project entities and other
 * levels get a pointer until namespace/component-level cost lands.
 */
const CostInsightsView = ({ kind }: { kind: InsightsEntityKind | null }) => {
  if (kind === 'system') {
    return <CostAnalysisPage />;
  }
  return (
    <Box p={2}>
      <Typography variant="body1" gutterBottom>
        Cost Insights are available at the project level today.
      </Typography>
      <Typography variant="body2" color="textSecondary">
        Open a project&apos;s Insights tab to analyze cost, or see the Cost
        Insights proposal (openchoreo discussion #3676) for namespace and
        component level coverage.
      </Typography>
    </Box>
  );
};

/**
 * Delivery Insights (DORA metrics) entity tab. One component serves all three
 * levels — the query scope is derived from the entity kind:
 *
 * - `domain` (Namespace): org-level, `{ namespace }`
 * - `system` (Project):   `{ namespace, project }`
 * - `component`:          `{ namespace, project, component }`
 *
 * The page hosts two inner tabs per the Insights design: Delivery Insights
 * (DORA) and Cost Insights (FinOps — available at project level today).
 * Authorization is enforced by the observer (insights:view); the tab itself is
 * feature-gated where it is mounted in the app's EntityPage.
 */
export const ObservabilityInsightsPage = () => {
  const { entity } = useEntity();
  const navigate = useNavigate();
  const location = useLocation();

  const { scope, kind, error } = useMemo((): {
    scope: DoraSearchScope | null;
    kind: InsightsEntityKind | null;
    error: string | null;
  } => {
    const annotations = entity.metadata.annotations ?? {};
    const entityKind = entity.kind.toLowerCase();
    const namespace =
      annotations[CHOREO_ANNOTATIONS.NAMESPACE] ??
      (entityKind === 'domain' ? entity.metadata.name : undefined);

    if (!namespace) {
      return {
        scope: null,
        kind: null,
        error: 'OpenChoreo namespace annotation not found on this entity',
      };
    }

    switch (entityKind) {
      case 'domain':
        return { scope: { namespace }, kind: 'domain', error: null };
      case 'system':
        return {
          scope: { namespace, project: entity.metadata.name },
          kind: 'system',
          error: null,
        };
      case 'component': {
        const project = annotations[CHOREO_ANNOTATIONS.PROJECT];
        const component = annotations[CHOREO_ANNOTATIONS.COMPONENT];
        if (!project || !component) {
          return {
            scope: null,
            kind: null,
            error:
              'OpenChoreo project/component annotations not found on this entity',
          };
        }
        return {
          scope: { namespace, project, component },
          kind: 'component',
          error: null,
        };
      }
      default:
        return {
          scope: null,
          kind: null,
          error: `Insights is not available for entity kind '${entity.kind}'`,
        };
    }
  }, [entity]);

  // Path-based inner tabs so the cost drill-down's nested routes
  // (/insights/cost/:reportId) survive navigation and deep links.
  const insightsBase = location.pathname.replace(/\/insights(\/.*)?$/, '/insights');
  const activeTab = /\/insights\/cost(\/|$)/.test(location.pathname)
    ? 'cost'
    : 'delivery';

  if (error) {
    return (
      <Box p={2}>
        <Alert severity="warning">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Tabs
        value={activeTab}
        onChange={(_, value) =>
          navigate(value === 'cost' ? `${insightsBase}/cost` : insightsBase)
        }
        indicatorColor="primary"
        textColor="primary"
      >
        <Tab label="Delivery Insights" value="delivery" />
        <Tab label="Cost Insights" value="cost" />
      </Tabs>
      <Divider />
      <Box mt={2}>
        <Routes>
          <Route
            path="/"
            element={<InsightsContent scope={scope} level={kind} />}
          />
          <Route path="cost/*" element={<CostInsightsView kind={kind} />} />
        </Routes>
      </Box>
    </Box>
  );
};
