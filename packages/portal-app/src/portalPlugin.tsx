import HomeIcon from '@material-ui/icons/Home';
import { VisitListener } from '@backstage/plugin-home';
import {
  AppRootElementBlueprint,
  createFrontendPlugin,
  createRouteRef,
  PageBlueprint,
  PluginWrapperBlueprint,
} from '@backstage/frontend-plugin-api';
import { DependencyGraphZoomOverrides } from './components/graph/DependencyGraphZoomOverrides';

export const homeRouteRef = createRouteRef();

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

// Upstream ships its own copy disabled; we contribute one.
const visitListenerElement = AppRootElementBlueprint.make({
  name: 'visit-listener',
  params: { element: <VisitListener /> },
});

const homePage = PageBlueprint.make({
  name: 'home',
  params: {
    path: '/',
    routeRef: homeRouteRef,
    title: 'Home',
    icon: <HomeIcon />,
    // Page renders its own <Page><Header>; suppress outer PageLayout header.
    noHeader: true,
    loader: () => import('./components/Home').then(m => <m.HomePage />),
  },
});

// Attachments to non-internal inputs (routes, root elements) live here.
// Internal-input attachments (themes/icons/nav-content/root-wrappers) live
// in `appModule.tsx` under pluginId 'app'.
export const portalAppPlugin = createFrontendPlugin({
  pluginId: 'openchoreo-portal-app',
  extensions: [
    queryProvider,
    dependencyGraphZoomOverridesElement,
    visitListenerElement,
    homePage,
  ],
});
