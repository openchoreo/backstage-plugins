import BubbleChartIcon from '@material-ui/icons/BubbleChart';
import {
  createFrontendPlugin,
  PageBlueprint,
  PluginWrapperBlueprint,
  SubPageBlueprint,
} from '@backstage/frontend-plugin-api';

import { platformOverviewRouteRef, rootRouteRef } from './routes';

const platformEngineerDashboardPage = PageBlueprint.make({
  name: 'platform-engineer-dashboard',
  params: {
    path: '/platform-engineer-view',
    routeRef: rootRouteRef,
    loader: () =>
      import('./views/PlatformEngineerDashboardView').then(m => (
        <m.PlatformEngineerDashboardView />
      )),
  },
});

/**
 * Host page of the Platform section.
 *
 * Deliberately has no `loader`: PageBlueprint's factory lets `loader` win over the
 * `pages` input, so a loader here would silently discard every contributed tab.
 * Without one it renders the header, the tab bar, a `<Route>` per tab and an index
 * redirect to the first tab.
 *
 * Tabs are `SubPageBlueprint` extensions attached to this page's id — Overview from
 * this plugin, Logs from openchoreo-observability. Any plugin can add one without
 * depending on this package.
 *
 * `title` + `icon` + `routeRef` are all load-bearing: the nav drops any page node
 * missing one of the three, which would delete the Platform sidebar entry.
 */
const platformOverviewPage = PageBlueprint.make({
  name: 'platform-overview',
  params: {
    path: '/platform-overview',
    routeRef: platformOverviewRouteRef,
    title: 'Platform',
    icon: <BubbleChartIcon />,
  },
});

// `relative` resolves within this plugin's namespace. The `name` is required —
// SubPageBlueprint's default `{ relative: { kind: 'page' } }` targets the *unnamed*
// page extension (`page:platform-engineer-core`), which does not exist here.
const platformOverviewTab = SubPageBlueprint.make({
  name: 'overview',
  attachTo: {
    relative: { kind: 'page', name: 'platform-overview' },
    input: 'pages',
  },
  params: {
    // No routeRef: `platformOverviewRouteRef` is registered on the host page, and
    // registering one ref twice makes it resolve to whichever was visited last.
    path: 'overview',
    title: 'Overview',
    loader: () =>
      import('./components/PlatformOverviewPage').then(m => (
        <m.PlatformOverviewPage />
      )),
  },
});

// Wraps this plugin's extensions in the shared OpenChoreoQueryProvider.
const queryProvider = PluginWrapperBlueprint.make({
  name: 'query-provider',
  params: defineParams =>
    defineParams({
      loader: async () => {
        const { OpenChoreoQueryProvider } = await import(
          '@openchoreo/backstage-plugin-react'
        );
        return { component: OpenChoreoQueryProvider };
      },
    }),
});

export default createFrontendPlugin({
  pluginId: 'platform-engineer-core',
  // Bound to the Platform page, not the dashboard: PageBlueprint derives the page
  // header's title link from `routes.root`, so pointing it at /platform-engineer-view
  // would make "Platform" link to an unrelated, nav-hidden page. `rootRouteRef` keeps
  // its id and stays bound to /platform-engineer-view via the dashboard page above.
  routes: { root: platformOverviewRouteRef },
  extensions: [
    queryProvider,
    platformEngineerDashboardPage,
    platformOverviewPage,
    platformOverviewTab,
  ],
});
