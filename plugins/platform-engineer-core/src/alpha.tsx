import {
  createFrontendPlugin,
  PageBlueprint,
  PluginWrapperBlueprint,
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

// Wraps this plugin's own extensions in the TanStack Query provider (see the
// openchoreo plugin's alpha for the full rationale). Shares the one `queryClient`
// singleton across all OpenChoreo plugins.
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

/**
 * NFS entry point for the Platform Engineer Core plugin.
 */
export default createFrontendPlugin({
  pluginId: 'platform-engineer-core',
  routes: { root: rootRouteRef },
  extensions: [queryProvider, platformEngineerDashboardPage],
});
