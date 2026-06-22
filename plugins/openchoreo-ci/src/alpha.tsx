import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';

import { rootRouteRef } from './routes';
import { openChoreoCiClientApiRef } from './api/OpenChoreoCiClientApi';
import { OpenChoreoCiClient } from './api/OpenChoreoCiClient';

const ciClientApi = ApiBlueprint.make({
  name: 'open-choreo-ci-client',
  params: defineParams =>
    defineParams({
      api: openChoreoCiClientApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new OpenChoreoCiClient(discoveryApi, fetchApi),
    }),
});

const workflowsEntityContent = EntityContentBlueprint.make({
  name: 'workflows',
  params: {
    path: '/workflows',
    title: 'Build',
    filter: 'kind:component',
    loader: () => import('./components/Workflows').then(m => <m.Workflows />),
  },
});

/**
 * NFS entry point for the OpenChoreo CI plugin.
 */
export default createFrontendPlugin({
  pluginId: 'openchoreo-ci',
  routes: { root: rootRouteRef },
  extensions: [ciClientApi, workflowsEntityContent],
});
