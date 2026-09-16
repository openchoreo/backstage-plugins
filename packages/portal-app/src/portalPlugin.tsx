import { VisitListener } from '@backstage/plugin-home';
import {
  AppRootElementBlueprint,
  createFrontendPlugin,
  PluginWrapperBlueprint,
} from '@backstage/frontend-plugin-api';
import { DependencyGraphZoomOverrides } from './components/graph/DependencyGraphZoomOverrides';

// Gives portal-owned pages a QueryClientProvider for OC hooks.
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

// MutationObserver fix for d3-graph zoom; must run in the routed subtree.
const dependencyGraphZoomOverridesElement = AppRootElementBlueprint.make({
  name: 'dependency-graph-zoom-overrides',
  params: { element: <DependencyGraphZoomOverrides /> },
});

// Upstream ships its own copy disabled; we contribute one. Powers the
// "Recently Visited" home widget by recording page visits.
const visitListenerElement = AppRootElementBlueprint.make({
  name: 'visit-listener',
  params: { element: <VisitListener /> },
});

// Attachments to non-internal inputs (routes, root elements) live here.
// The home page itself is provided by `@backstage/plugin-home` (`page:home`);
// our custom layout and widgets are contributed from `./components/Home`.
export const portalAppPlugin = createFrontendPlugin({
  pluginId: 'openchoreo-portal-app',
  extensions: [
    queryProvider,
    dependencyGraphZoomOverridesElement,
    visitListenerElement,
  ],
});
