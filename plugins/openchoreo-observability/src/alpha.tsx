import {
  ApiBlueprint,
  createExtensionInput,
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
import {
  DefaultLogRowActionRendererApi,
  logRowActionRendererApiRef,
} from './api/LogRowActionRendererApi';
import { LogRowActionBlueprint } from './alpha/LogRowActionBlueprint';

export { LogRowActionBlueprint } from './alpha/LogRowActionBlueprint';
export {
  logRowActionRendererApiRef,
  type LogRowActionRendererApi,
} from './api/LogRowActionRendererApi';

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
 * Registry API for host-injected log-row action renderers. Collects every
 * `LogRowActionBlueprint` extension contributed by the host (or any other
 * plugin) and exposes the first renderer via `useApi(logRowActionRendererApiRef)`.
 *
 * Mirrors upstream's `formDecoratorsApi` (plugin-scaffolder) — see
 * `node_modules/@backstage/plugin-scaffolder/dist/alpha/api/FormDecoratorsApi.esm.js`.
 */
const logRowActionRendererApi = ApiBlueprint.makeWithOverrides({
  name: 'log-row-action-renderer',
  inputs: {
    renderers: createExtensionInput([LogRowActionBlueprint.dataRefs.renderer]),
  },
  factory(originalFactory, { inputs }) {
    const renderers = inputs.renderers.map(e =>
      e.get(LogRowActionBlueprint.dataRefs.renderer),
    );
    return originalFactory(defineParams =>
      defineParams({
        api: logRowActionRendererApiRef,
        deps: {},
        factory: () => DefaultLogRowActionRendererApi.create({ renderers }),
      }),
    );
  },
});

/**
 * NFS entry point for the OpenChoreo Observability plugin.
 *
 * Registers the three observability backend clients plus the
 * log-row-action registry API. Entity tabs (Metrics, Traces, RCA,
 * RuntimeLogs, etc.) ride through the legacy `src/plugin.ts` until
 * a follow-up commit converts them to `EntityContentBlueprint`.
 */
export default createFrontendPlugin({
  pluginId: 'openchoreo-observability',
  routes: { root: rootRouteRef },
  extensions: [
    observabilityApi,
    rcaAgentApi,
    finopsAgentApi,
    logRowActionRendererApi,
  ],
});
