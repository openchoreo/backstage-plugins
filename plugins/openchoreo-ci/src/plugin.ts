import {
  createPlugin,
  createRoutableExtension,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';
import { openChoreoCiClientApiRef } from './api/OpenChoreoCiClientApi';
import { OpenChoreoCiClient } from './api/OpenChoreoCiClient';

/**
 * OpenChoreo CI Plugin
 *
 * This plugin provides CI/Workflow functionality for OpenChoreo components.
 * It includes workflow runs listing, build triggering, and configuration management.
 */
export const openchoreoCiPlugin = createPlugin({
  id: 'openchoreo-ci',
  routes: {
    root: rootRouteRef,
  },
  apis: [
    createApiFactory({
      api: openChoreoCiClientApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new OpenChoreoCiClient(discoveryApi, fetchApi),
    }),
  ],
});

/**
 * Workflows component - displays workflow runs and configuration
 * for a component entity. This is the main entry point for the CI plugin.
 *
 * Exported as a routable extension to ensure proper plugin registration
 * and feature flag discovery.
 */
export const WorkflowsPage = openchoreoCiPlugin.provide(
  createRoutableExtension({
    name: 'WorkflowsPage',
    component: () => import('./components/Workflows').then(m => m.Workflows),
    mountPoint: rootRouteRef,
  }),
);
