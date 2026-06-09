import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';

import {
  rootCatalogEnvironmentRouteRef,
  accessControlRouteRef,
  resourceEnvironmentsRouteRef,
} from './routes';
import { openChoreoClientApiRef } from './api/OpenChoreoClientApi';
import { OpenChoreoClient } from './api/OpenChoreoClient';

const openChoreoClientApi = ApiBlueprint.make({
  name: 'open-choreo-client',
  params: defineParams =>
    defineParams({
      api: openChoreoClientApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new OpenChoreoClient(discoveryApi, fetchApi),
    }),
});

/**
 * NFS entry point for the OpenChoreo plugin.
 *
 * Registers the OpenChoreoClient API. The four legacy routable extensions
 * (Environments, ResourceEnvironments, CellDiagram, AccessControlPage) and
 * four component cards (WorkflowsOverviewCard, DeploymentStatusCard,
 * RuntimeHealthCard, DeploymentPipelineCard) continue to flow through
 * src/plugin.ts because the host app mounts them as plain React components
 * inside legacy EntityLayout.Route/Card structures. Wire them as
 * EntityContentBlueprint / EntityCardBlueprint extensions here when the host
 * moves to NFS-driven entity tabs.
 */
export default createFrontendPlugin({
  pluginId: 'openchoreo',
  routes: {
    catalogEnvironment: rootCatalogEnvironmentRouteRef,
    accessControl: accessControlRouteRef,
    resourceEnvironments: resourceEnvironmentsRouteRef,
  },
  extensions: [openChoreoClientApi],
});
