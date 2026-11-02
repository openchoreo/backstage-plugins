import AssessmentIcon from '@material-ui/icons/Assessment';
import {
  ApiBlueprint,
  createFrontendFeatureLoader,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { dynamicChecksApiRef } from './api/DynamicChecksApi';
import { DynamicChecksClient } from './api/DynamicChecksClient';
import { ScorecardsGate } from './components/ScorecardsGate';
import { rootRouteRef } from './routes';

const DEFAULT_TITLE = 'Scorecards';

const dynamicChecksApi = ApiBlueprint.make({
  name: 'dynamic-checks',
  params: defineParams =>
    defineParams({
      api: dynamicChecksApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new DynamicChecksClient(discoveryApi, fetchApi),
    }),
});

/**
 * Configurable under `app.extensions` as `page:tech-insights-scorecards`:
 * `path` and `title` (built in).
 */
const scorecardsPage = PageBlueprint.makeWithOverrides({
  factory(originalFactory, { config }) {
    const title = config.title ?? DEFAULT_TITLE;
    return originalFactory({
      path: '/scorecards',
      routeRef: rootRouteRef,
      title: DEFAULT_TITLE,
      icon: <AssessmentIcon />,
      // The page renders its own <Page><Header>.
      noHeader: true,
      loader: () =>
        import('./components/ScorecardsPage').then(m => (
          <ScorecardsGate pageTitle={title}>
            <m.ScorecardsPage title={title} />
          </ScorecardsGate>
        )),
    });
  },
});

/**
 * Scorecards over Tech Insights: a catalog-wide page for managing checks and
 * the data sources they read.
 *
 * @alpha
 */
export const techInsightsScorecardsPlugin = createFrontendPlugin({
  pluginId: 'tech-insights-scorecards',
  routes: { root: rootRouteRef },
  extensions: [dynamicChecksApi, scorecardsPage],
});

/**
 * What feature discovery installs: the plugin alone.
 *
 * @alpha
 */
export default createFrontendFeatureLoader({
  loader: () => [techInsightsScorecardsPlugin],
});
