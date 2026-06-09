import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';

import { rootRouteRef } from './routes';
import { genericWorkflowsClientApiRef } from './api/GenericWorkflowsClientApi';
import { GenericWorkflowsClient } from './api/GenericWorkflowsClient';

const genericWorkflowsClientApi = ApiBlueprint.make({
  name: 'generic-workflows-client',
  params: defineParams =>
    defineParams({
      api: genericWorkflowsClientApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new GenericWorkflowsClient(discoveryApi, fetchApi),
    }),
});

const genericWorkflowsPage = PageBlueprint.make({
  name: 'generic-workflows',
  params: {
    path: '/workflows',
    routeRef: rootRouteRef,
    loader: () =>
      import('./components/GenericWorkflowsPage').then(m => (
        <m.GenericWorkflowsPage />
      )),
  },
});

/**
 * NFS entry point for the OpenChoreo generic-workflows plugin.
 */
export default createFrontendPlugin({
  pluginId: 'openchoreo-workflows',
  routes: { root: rootRouteRef },
  extensions: [genericWorkflowsClientApi, genericWorkflowsPage],
});
