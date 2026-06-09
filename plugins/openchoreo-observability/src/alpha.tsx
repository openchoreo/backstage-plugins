import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';

import { rootRouteRef } from './routes';
import {
  observabilityApiRef,
  ObservabilityClient,
} from './api/ObservabilityApi';
import { rcaAgentApiRef, RCAAgentClient } from './api/RCAAgentApi';
import { finopsAgentApiRef, FinOpsAgentClient } from './api/FinOpsAgentApi';

const observabilityApi = ApiBlueprint.make({
  name: 'observability',
  params: defineParams =>
    defineParams({
      api: observabilityApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new ObservabilityClient({ discoveryApi, fetchApi }),
    }),
});

const rcaAgentApi = ApiBlueprint.make({
  name: 'rca-agent',
  params: defineParams =>
    defineParams({
      api: rcaAgentApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new RCAAgentClient({ discoveryApi, fetchApi }),
    }),
});

const finopsAgentApi = ApiBlueprint.make({
  name: 'finops-agent',
  params: defineParams =>
    defineParams({
      api: finopsAgentApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new FinOpsAgentClient({ discoveryApi, fetchApi }),
    }),
});

/**
 * NFS entry point for the OpenChoreo Observability plugin.
 *
 * Registers the three observability backend clients. The legacy
 * `createRoutableExtension` page components (ObservabilityMetrics,
 * ObservabilityTraces, …) continue to flow through `src/plugin.ts` and are
 * mounted manually by the host app via `<EntityLayout.Route>` blocks so they
 * can receive per-mount props (e.g. `renderRowAction`). When the host moves
 * those mounts to NFS-driven entity tabs, additional EntityContentBlueprint
 * extensions can be added here.
 */
export default createFrontendPlugin({
  pluginId: 'openchoreo-observability',
  routes: { root: rootRouteRef },
  extensions: [observabilityApi, rcaAgentApi, finopsAgentApi],
});
