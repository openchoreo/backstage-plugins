import {
  createPlugin,
  createRoutableExtension,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';
import { genericWorkflowsClientApiRef } from './api/GenericWorkflowsClientApi';
import { GenericWorkflowsClient } from './api/GenericWorkflowsClient';

/**
 * OpenChoreo Generic Workflows Plugin
 *
 * This plugin provides UI for org-level generic workflows.
 * It includes workflow templates listing, run management, and triggering.
 */
export const openchoreoWorkflowsPlugin = createPlugin({
  id: 'openchoreo-workflows',
  routes: {
    root: rootRouteRef,
  },
  apis: [
    createApiFactory({
      api: genericWorkflowsClientApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new GenericWorkflowsClient(discoveryApi, fetchApi),
    }),
  ],
});

/**
 * GenericWorkflowsPage - Main page for managing org-level workflows
 *
 * Exported as a routable extension to ensure proper plugin registration.
 */
export const GenericWorkflowsPage = openchoreoWorkflowsPlugin.provide(
  createRoutableExtension({
    name: 'GenericWorkflowsPage',
    component: () =>
      import('./components/GenericWorkflowsPage').then(
        m => m.GenericWorkflowsPage,
      ),
    mountPoint: rootRouteRef,
  }),
);
