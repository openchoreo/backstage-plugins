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
 * Workflows page component - displays workflow runs and configuration
 * for a component entity.
 */
export const OpenchoreoCiPage = openchoreoCiPlugin.provide(
  createRoutableExtension({
    name: 'OpenchoreoCiPage',
    component: () => import('./components/Workflows').then(m => m.Workflows),
    mountPoint: rootRouteRef,
  }),
);

/**
 * Alias for backwards compatibility and clarity
 */
export const WorkflowsPage = OpenchoreoCiPage;
