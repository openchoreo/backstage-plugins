import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';

import { rootRouteRef } from './routes';

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
 * NFS entry point for the Platform Engineer Core plugin.
 */
export default createFrontendPlugin({
  pluginId: 'platform-engineer-core',
  routes: { root: rootRouteRef },
  extensions: [platformEngineerDashboardPage],
});
