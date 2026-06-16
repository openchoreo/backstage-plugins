import {
  ApiBlueprint,
  createExtensionInput,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { FeatureGatedContent } from '@openchoreo/backstage-plugin-react';

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
 * Component-page entity tabs (kind:component). Each tab loads its page
 * component lazily and wraps it in `FeatureGatedContent feature="observability"`
 * so the tab is in-tree (so routing stays valid) but renders an
 * empty-state when the host has observability disabled.
 *
 * The runtime-logs tab does NOT pass a `renderRowAction` prop — the page
 * component reads the host-registered renderer through
 * `useApiHolder().get(logRowActionRendererApiRef)` (see Step 1).
 */
const runtimeLogsEntityContent = EntityContentBlueprint.make({
  name: 'runtime-logs',
  params: {
    path: '/runtime-logs',
    title: 'Logs',
    filter: 'kind:component',
    loader: () =>
      import('./components/RuntimeLogs/ObservabilityRuntimeLogsPage').then(
        m => (
          <FeatureGatedContent feature="observability">
            <m.ObservabilityRuntimeLogsPage />
          </FeatureGatedContent>
        ),
      ),
  },
});

const runtimeEventsEntityContent = EntityContentBlueprint.make({
  name: 'runtime-events',
  params: {
    path: '/runtime-events',
    title: 'Events',
    filter: 'kind:component',
    loader: () =>
      import('./components/RuntimeEvents/ObservabilityRuntimeEventsPage').then(
        m => (
          <FeatureGatedContent feature="observability">
            <m.ObservabilityRuntimeEventsPage />
          </FeatureGatedContent>
        ),
      ),
  },
});

const metricsEntityContent = EntityContentBlueprint.make({
  name: 'metrics',
  params: {
    path: '/metrics',
    title: 'Metrics',
    filter: 'kind:component',
    loader: () =>
      import('./components/Metrics/ObservabilityMetricsPage').then(m => (
        <FeatureGatedContent feature="observability">
          <m.ObservabilityMetricsPage />
        </FeatureGatedContent>
      )),
  },
});

const alertsEntityContent = EntityContentBlueprint.make({
  name: 'alerts',
  params: {
    path: '/alerts',
    title: 'Alerts',
    filter: 'kind:component',
    loader: () =>
      import('./components/Alerts/ObservabilityAlertsPage').then(m => (
        <FeatureGatedContent feature="observability">
          <m.ObservabilityAlertsPage />
        </FeatureGatedContent>
      )),
  },
});

const wirelogsEntityContent = EntityContentBlueprint.make({
  name: 'wirelogs',
  params: {
    path: '/wirelogs',
    title: 'Wirelogs',
    filter: 'kind:component',
    loader: () =>
      import('./components/Wirelogs/ObservabilityWirelogsPage').then(m => (
        <FeatureGatedContent feature="observability">
          <m.ObservabilityWirelogsPage />
        </FeatureGatedContent>
      )),
  },
});

/**
 * NFS entry point for the OpenChoreo Observability plugin.
 *
 * Registers the three observability backend clients, the log-row-action
 * registry API, and the component-page entity tabs (Logs, Events,
 * Metrics, Alerts, Wirelogs). System-page tabs (ProjectRuntimeLogs,
 * Traces, Incidents, RCA, CostAnalysis) follow in a separate commit.
 */
export default createFrontendPlugin({
  pluginId: 'openchoreo-observability',
  routes: { root: rootRouteRef },
  extensions: [
    observabilityApi,
    rcaAgentApi,
    finopsAgentApi,
    logRowActionRendererApi,
    runtimeLogsEntityContent,
    runtimeEventsEntityContent,
    metricsEntityContent,
    alertsEntityContent,
    wirelogsEntityContent,
  ],
});
