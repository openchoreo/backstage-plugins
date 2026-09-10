import BubbleChartIcon from '@material-ui/icons/BubbleChart';
import {
  createFrontendPlugin,
  PageBlueprint,
  PluginWrapperBlueprint,
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

// Ships title + icon so adopters auto-get a sidebar entry via DefaultNavContent.
const platformOverviewPage = PageBlueprint.make({
  name: 'platform-overview',
  params: {
    path: '/platform-overview',
    routeRef: platformOverviewRouteRef,
    title: 'Platform',
    icon: <BubbleChartIcon />,
    // Page renders its own <Page><Header>; suppress outer PageLayout header.
    noHeader: true,
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
  routes: { root: rootRouteRef },
  extensions: [
    queryProvider,
    platformEngineerDashboardPage,
    platformOverviewPage,
  ],
});
